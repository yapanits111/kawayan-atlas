"""Seed the database from the JSON files in app/seed_data/.

Idempotent: run with `python -m app.seed` from the backend/ directory. It creates
tables if needed, then upserts every seed row (safe to re-run).
"""
import json
from pathlib import Path

from .database import Base, SessionLocal, engine
from .models import BambooSpecies, JointType, Template

SEED_DIR = Path(__file__).parent / "seed_data"


def _load(name: str) -> list[dict]:
    with open(SEED_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for row in _load("species.json"):
            db.merge(BambooSpecies(**row))
        for row in _load("joints.json"):
            db.merge(JointType(**row))
        for row in _load("templates.json"):
            db.merge(Template(**row))
        db.commit()

        counts = {
            "species": db.query(BambooSpecies).count(),
            "joints": db.query(JointType).count(),
            "templates": db.query(Template).count(),
        }
        print(f"Seeded: {counts}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
