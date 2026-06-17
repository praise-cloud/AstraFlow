"""initial_schema

Create Date: 2026-05-31
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column(
            "business_type",
            sa.Enum(
                "restaurant", "taxi", "delivery", "retail", "logistics",
                name="business_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "fuel_prices",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date, nullable=False, index=True),
        sa.Column("fuel_type", sa.String(20), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "business_type",
            sa.Enum(
                "restaurant", "taxi", "delivery", "retail", "logistics",
                name="business_type",
            ),
            nullable=False,
        ),
        sa.Column("content", sa.String(500), nullable=False),
        sa.Column("risk_level", sa.String(20), nullable=False),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
    )


def downgrade():
    op.drop_table("recommendations")
    op.drop_table("fuel_prices")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS business_type")
