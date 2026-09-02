"""Anonymous save/share of designs (Release 1 — no accounts).

A design is created without any user; it is addressable by its generated id, so it
can be shared via a link. Owner association arrives in Release 2 with auth.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Design
from ..schemas import DesignCreate, DesignOut

router = APIRouter(prefix="/api/designs", tags=["designs"])


@router.post("", response_model=DesignOut, status_code=201)
def create_design(payload: DesignCreate, db: Session = Depends(get_db)):
    design = Design(
        id=uuid.uuid4().hex[:12],
        based_on_template_id=payload.based_on_template_id,
        based_on_template_version=payload.based_on_template_version,
        components=payload.components,
        params=payload.params,
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    return design


@router.get("/{design_id}", response_model=DesignOut)
def get_design(design_id: str, db: Session = Depends(get_db)):
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status_code=404, detail="Design not found")
    return design
