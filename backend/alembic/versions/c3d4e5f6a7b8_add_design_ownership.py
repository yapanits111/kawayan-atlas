"""add design ownership (owner_id + title on designs)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("designs") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("title", sa.String(), nullable=True))
        batch.create_index("ix_designs_owner_id", ["owner_id"])
        batch.create_foreign_key("fk_designs_owner_id_users", "users", ["owner_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("designs") as batch:
        batch.drop_constraint("fk_designs_owner_id_users", type_="foreignkey")
        batch.drop_index("ix_designs_owner_id")
        batch.drop_column("title")
        batch.drop_column("owner_id")
