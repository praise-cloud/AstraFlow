"""add_prediction_logs

Create Date: 2026-07-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "prediction_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("model_type", sa.String(20), nullable=False, index=True),
        sa.Column("model_version", sa.Integer, nullable=True),
        sa.Column("forecast_date", sa.Date, nullable=False, index=True),
        sa.Column("predicted_price", sa.Float, nullable=False),
        sa.Column("actual_price", sa.Float, nullable=True),
        sa.Column("error", sa.Float, nullable=True),
        sa.Column("abs_error", sa.Float, nullable=True),
        sa.Column("pct_error", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("prediction_logs")
