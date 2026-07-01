import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from backend.db.database import SessionLocal
from backend.models.model_registry import ModelRegistry

logger = logging.getLogger("astraflow.model_manager")

try:
    import joblib
    HAS_JOBlIB = True
except ImportError:
    HAS_JOBlIB = False
    logger.warning("joblib not installed — model persistence disabled")


_STORAGE_DIR = Path(__file__).resolve().parent.parent / "models_storage"


class ModelManager:
    """Persist, load, and version ML models via joblib + model_registry table.

    Models are serialized to ``backend/models_storage/`` and tracked in the
    ``model_registry`` database table.  Only one version per (model_type,
    model_name) pair is active at a time.
    """

    _lock = threading.RLock()

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    @classmethod
    def save(
        cls,
        model: Any,
        model_type: str,
        model_name: str = "ensemble_forecaster",
        metrics: Optional[dict] = None,
        trained_until: Optional[str] = None,
        num_samples: Optional[int] = None,
        feature_names: Optional[list[str]] = None,
        extra_metadata: Optional[dict] = None,
    ) -> Optional[int]:
        """Serialize *model* to disk and record it in the registry.

        Returns the new version number, or ``None`` on failure.
        """
        if not HAS_JOBlIB:
            logger.error("Cannot save model — joblib is not installed")
            return None

        _STORAGE_DIR.mkdir(parents=True, exist_ok=True)

        with cls._lock:
            db = SessionLocal()
            try:
                last = (
                    db.query(ModelRegistry)
                    .filter_by(model_type=model_type, model_name=model_name)
                    .order_by(ModelRegistry.version.desc())
                    .first()
                )
                version = (last.version + 1) if last else 1

                filename = f"{model_type}_{model_name}_v{version}.joblib"
                filepath = _STORAGE_DIR / filename

                joblib.dump(model, str(filepath))

                now = datetime.now(timezone.utc)
                record = ModelRegistry(
                    model_type=model_type,
                    model_name=model_name,
                    version=version,
                    is_active=True,
                    trained_at=now,
                    trained_until=trained_until,
                    num_samples=num_samples,
                    metrics=json.dumps(metrics) if metrics else None,
                    serialized_path=str(filepath.relative_to(_STORAGE_DIR.parent.parent)),
                    feature_names=json.dumps(feature_names) if feature_names else None,
                    extra_metadata=json.dumps(extra_metadata) if extra_metadata else None,
                )
                db.add(record)

                old_versions = (
                    db.query(ModelRegistry)
                    .filter(
                        ModelRegistry.model_type == model_type,
                        ModelRegistry.model_name == model_name,
                        ModelRegistry.is_active == True,
                    )
                    .all()
                )
                for old in old_versions:
                    old.is_active = False

                db.commit()
                logger.info(
                    "Saved %s/%s v%d (%d samples, metrics=%s)",
                    model_type, model_name, version, num_samples or 0, metrics,
                )
                return version

            except Exception:
                logger.exception("Failed to save model %s/%s", model_type, model_name)
                db.rollback()
                return None
            finally:
                db.close()

    # ------------------------------------------------------------------
    # Load
    # ------------------------------------------------------------------

    @classmethod
    def load_active(
        cls,
        model_type: str,
        model_name: str = "ensemble_forecaster",
    ) -> tuple[Any, Optional[dict]]:
        """Load the currently active model from disk.

        Returns ``(model, record_dict)`` or ``(None, None)``.
        """
        if not HAS_JOBlIB:
            return None, None

        db = SessionLocal()
        try:
            record = (
                db.query(ModelRegistry)
                .filter_by(
                    model_type=model_type,
                    model_name=model_name,
                    is_active=True,
                )
                .order_by(ModelRegistry.version.desc())
                .first()
            )
            if record is None:
                return None, None

            if record.serialized_path is None:
                return None, None

            filepath = _STORAGE_DIR.parent.parent / record.serialized_path
            if not filepath.exists():
                logger.warning("Serialized model file missing: %s", filepath)
                return None, None

            model = joblib.load(str(filepath))
            info = cls._record_to_dict(record)
            logger.info(
                "Loaded %s/%s v%d from %s",
                model_type, model_name, record.version, filepath,
            )
            return model, info

        except Exception:
            logger.exception("Failed to load %s/%s", model_type, model_name)
            return None, None
        finally:
            db.close()

    @classmethod
    def load_version(
        cls,
        version_id: int,
    ) -> tuple[Any, Optional[dict]]:
        """Load a specific model version by its registry ID."""
        if not HAS_JOBlIB:
            return None, None

        db = SessionLocal()
        try:
            record = db.query(ModelRegistry).filter_by(id=version_id).first()
            if record is None or record.serialized_path is None:
                return None, None

            filepath = _STORAGE_DIR.parent.parent / record.serialized_path
            if not filepath.exists():
                return None, None

            model = joblib.load(str(filepath))
            return model, cls._record_to_dict(record)
        except Exception:
            logger.exception("Failed to load version %d", version_id)
            return None, None
        finally:
            db.close()

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    @classmethod
    def list_versions(
        cls,
        model_type: str,
        model_name: str = "ensemble_forecaster",
    ) -> list[dict]:
        """Return all versions for a given model type/name pair."""
        db = SessionLocal()
        try:
            records = (
                db.query(ModelRegistry)
                .filter_by(model_type=model_type, model_name=model_name)
                .order_by(ModelRegistry.version.desc())
                .all()
            )
            return [cls._record_to_dict(r) for r in records]
        finally:
            db.close()

    # ------------------------------------------------------------------
    # Rollback
    # ------------------------------------------------------------------

    @classmethod
    def rollback(cls, model_type: str, version: int) -> bool:
        """Deactivate current model and activate *version*."""
        with cls._lock:
            db = SessionLocal()
            try:
                target = (
                    db.query(ModelRegistry)
                    .filter_by(
                        model_type=model_type,
                        version=version,
                    )
                    .first()
                )
                if target is None:
                    logger.warning("Rollback target version %d not found", version)
                    return False

                old_versions = (
                    db.query(ModelRegistry)
                    .filter(
                        ModelRegistry.model_type == model_type,
                        ModelRegistry.is_active == True,
                    )
                    .all()
                )
                for old in old_versions:
                    old.is_active = False

                target.is_active = True
                db.commit()
                logger.info("Rolled back %s to version %d", model_type, version)
                return True
            except Exception:
                logger.exception("Rollback failed for %s v%d", model_type, version)
                db.rollback()
                return False
            finally:
                db.close()

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    @classmethod
    def delete_old_versions(
        cls,
        model_type: str,
        model_name: str = "ensemble_forecaster",
        keep_last: int = 10,
    ) -> int:
        """Remove older versions beyond ``keep_last`` (disk + DB)."""
        with cls._lock:
            db = SessionLocal()
            try:
                records = (
                    db.query(ModelRegistry)
                    .filter_by(model_type=model_type, model_name=model_name)
                    .order_by(ModelRegistry.version.desc())
                    .all()
                )
                to_delete = records[keep_last:]
                count = 0
                for rec in to_delete:
                    if rec.serialized_path:
                        path = _STORAGE_DIR.parent.parent / rec.serialized_path
                        try:
                            path.unlink(missing_ok=True)
                        except Exception:
                            pass
                    db.delete(rec)
                    count += 1
                db.commit()
                if count:
                    logger.info("Pruned %d old versions of %s/%s", count, model_type, model_name)
                return count
            except Exception:
                logger.exception("Failed to prune old versions")
                db.rollback()
                return 0
            finally:
                db.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _record_to_dict(record: ModelRegistry) -> dict:
        return {
            "id": record.id,
            "model_type": record.model_type,
            "model_name": record.model_name,
            "version": record.version,
            "is_active": record.is_active,
            "trained_at": str(record.trained_at) if record.trained_at else None,
            "trained_until": str(record.trained_until) if record.trained_until else None,
            "num_samples": record.num_samples,
            "metrics": json.loads(record.metrics) if record.metrics else None,
            "feature_names": json.loads(record.feature_names) if record.feature_names else None,
            "metadata": json.loads(record.extra_metadata) if record.extra_metadata else None,
        }
