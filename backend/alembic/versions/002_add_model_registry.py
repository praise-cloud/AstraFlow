"""add_model_registry

Create Date: 2026-07-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "model_registry",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("model_type", sa.String(20), nullable=False, index=True),
        sa.Column("model_name", sa.String(50), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("is_active", sa.Boolean, default=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trained_until", sa.Date, nullable=True),
        sa.Column("num_samples", sa.Integer, nullable=True),
        sa.Column("metrics", sa.Text, nullable=True),
        sa.Column("serialized_path", sa.String(512), nullable=True),
        sa.Column("feature_names", sa.Text, nullable=True),
        sa.Column("metadata", sa.Text, nullable=True),
    )


def downgrade():
    op.drop_table("model_registry")
