"""Joint / connection endpoints — list (with filtering) and detail."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import JointType
from ..schemas import JointOut

router = APIRouter(prefix="/api/joints", tags=["joints"])


@router.get("", response_model=list[JointOut])
def list_joints(
    db: Session = Depends(get_db),
    species_id: str | None = Query(
        default=None, description="Filter to joints applicable to a species"
    ),
    q: str | None = Query(default=None, description="Search name/description"),
):
    rows = db.execute(select(JointType).order_by(JointType.name)).scalars().all()

    def matches(j: JointType) -> bool:
        if species_id and species_id not in j.applicable_species:
            return False
        if q:
            hay = f"{j.name} {j.description}".lower()
            if q.lower() not in hay:
                return False
        return True

    return [j for j in rows if matches(j)]


@router.get("/{joint_id}", response_model=JointOut)
def get_joint(joint_id: str, db: Session = Depends(get_db)):
    joint = db.get(JointType, joint_id)
    if joint is None:
        raise HTTPException(status_code=404, detail="Joint not found")
    return joint
