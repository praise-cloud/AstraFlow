"""add_route_logs

Create Date: 2026-07-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "route_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("origin_lat", sa.Float, nullable=False),
        sa.Column("origin_lng", sa.Float, nullable=False),
        sa.Column("dest_lat", sa.Float, nullable=False),
        sa.Column("dest_lng", sa.Float, nullable=False),
        sa.Column("distance_km", sa.Float, nullable=False),
        sa.Column("duration_min", sa.Float, nullable=False),
        sa.Column("traffic_delay_min", sa.Float, default=0.0),
        sa.Column("time_of_day", sa.Integer, nullable=True),
        sa.Column("day_of_week", sa.Integer, nullable=True),
        sa.Column("fuel_type", sa.String(20), nullable=True),
        sa.Column("fuel_price", sa.Float, nullable=True),
        sa.Column("predicted_liters", sa.Float, nullable=True),
        sa.Column("predicted_cost", sa.Float, nullable=True),
        sa.Column("actual_liters", sa.Float, nullable=True),
        sa.Column("actual_cost", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("route_logs")
