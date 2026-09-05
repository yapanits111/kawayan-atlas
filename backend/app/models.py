"""SQLAlchemy ORM models — the Release 1 content schema (see PLAN.md section 5).

List/dict fields use JSON columns so the same models run on both SQLite (local dev)
and Postgres (Neon, deployment) without change. On Postgres these map to JSONB-friendly
storage; on SQLite they serialize transparently.
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BambooSpecies(Base):
    __tablename__ = "bamboo_species"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name_local: Mapped[str] = mapped_column(String, index=True)
    name_scientific: Mapped[str] = mapped_column(String)
    region: Mapped[str] = mapped_column(String)
    density: Mapped[str] = mapped_column(String)  # e.g. "600-700 kg/m3"
    culm_diam_range: Mapped[str] = mapped_column(String)  # e.g. "80-150 mm"
    wall_thickness_range: Mapped[str] = mapped_column(String)  # e.g. "8-20 mm"
    treatment_methods: Mapped[list] = mapped_column(JSON, default=list)
    structural_role: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)


class JointType(Base):
    __tablename__ = "joint_types"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    applicable_species: Mapped[list] = mapped_column(JSON, default=list)
    applicable_culm_sizes: Mapped[str] = mapped_column(String, default="")
    load_notes: Mapped[str] = mapped_column(Text, default="")
    failure_mode: Mapped[str] = mapped_column(Text, default="")
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    category: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[str] = mapped_column(String, default="1", server_default="1")
    components: Mapped[list] = mapped_column(JSON, default=list)
    default_bom: Mapped[list] = mapped_column(JSON, default=list)
    known_span_range: Mapped[str] = mapped_column(String, default="")
    hero_image: Mapped[str | None] = mapped_column(String, nullable=True)


class Design(Base):
    """Anonymous saved/shared design (Release 1 has no accounts).

    An owner_id column is added in Release 2 when auth arrives.
    """

    __tablename__ = "designs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    based_on_template_id: Mapped[str | None] = mapped_column(
        ForeignKey("templates.id"), nullable=True
    )
    based_on_template_version: Mapped[str | None] = mapped_column(String, nullable=True)
    components: Mapped[list] = mapped_column(JSON, default=list)
    params: Mapped[dict] = mapped_column(JSON, default=dict)  # span/load params
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    template: Mapped["Template | None"] = relationship()
