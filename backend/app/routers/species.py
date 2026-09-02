"""Bamboo species endpoints — list (with filtering) and detail."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BambooSpecies
from ..schemas import SpeciesOut

router = APIRouter(prefix="/api/species", tags=["species"])


@router.get("", response_model=list[SpeciesOut])
def list_species(
    db: Session = Depends(get_db),
    region: str | None = Query(default=None, description="Filter by region substring"),
    role: str | None = Query(default=None, description="Filter by structural role"),
    q: str | None = Query(default=None, description="Search local/scientific name"),
):
    stmt = select(BambooSpecies).order_by(BambooSpecies.name_local)
    rows = db.execute(stmt).scalars().all()

    # Filter in Python: JSON-array containment is dialect-specific, and the
    # dataset is small, so keeping this portable across SQLite/Postgres is worth it.
    def matches(s: BambooSpecies) -> bool:
        if region and region.lower() not in s.region.lower():
            return False
        if role and role.lower() not in [r.lower() for r in s.structural_role]:
            return False
        if q:
            hay = f"{s.name_local} {s.name_scientific}".lower()
            if q.lower() not in hay:
                return False
        return True

    return [s for s in rows if matches(s)]


@router.get("/{species_id}", response_model=SpeciesOut)
def get_species(species_id: str, db: Session = Depends(get_db)):
    species = db.get(BambooSpecies, species_id)
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")
    return species
