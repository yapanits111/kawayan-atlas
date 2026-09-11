"""add accounts (users + graph ownership)

Revision ID: a1b2c3d4e5f6
Revises: 607182b7e999
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "607182b7e999"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # batch mode so the ALTERs also work on SQLite (which rebuilds the table).
    with op.batch_alter_table("graphs") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(), nullable=True))
        batch.add_column(sa.Column("title", sa.String(), nullable=True))
        batch.create_index("ix_graphs_owner_id", ["owner_id"])
        batch.create_foreign_key("fk_graphs_owner_id_users", "users", ["owner_id"], ["id"])


def downgrade() -> None:
    with op.batch_alter_table("graphs") as batch:
        batch.drop_constraint("fk_graphs_owner_id_users", type_="foreignkey")
        batch.drop_index("ix_graphs_owner_id")
        batch.drop_column("title")
        batch.drop_column("owner_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
