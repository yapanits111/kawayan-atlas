"""Save/share of Studio designs. Anonymous share links (Release 1) plus account-owned
designs with a title, gallery listing, rename and delete (Release 2)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Design, Template, User
from ..schemas import DesignCreate, DesignOut, DesignSummary, DesignUpdate
from .auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/designs", tags=["designs"])


def _owned_or_404(design_id: str, db: Session, user: User) -> Design:
    """Fetch a design the user owns, or 404 — a not-owned design reads as not-found."""
    design = db.get(Design, design_id)
    if design is None or design.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Design not found")
    return design


@router.post("", response_model=DesignOut, status_code=201)
def create_design(
    payload: DesignCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    # Stamp the template's CURRENT version server-side (authoritative), so a design
    # records which version of the template it forked from even as templates evolve.
    template_version: str | None = None
    if payload.based_on_template_id:
        template = db.get(Template, payload.based_on_template_id)
        template_version = template.version if template else None

    design = Design(
        id=uuid.uuid4().hex[:12],
        based_on_template_id=payload.based_on_template_id,
        based_on_template_version=template_version,
        components=[c.model_dump(exclude_none=True) for c in payload.components],
        params=payload.params.model_dump(exclude_none=True),
        owner_id=user.id if user else None,
        title=(payload.title.strip() or None) if payload.title else None,
    )
    db.add(design)
    db.commit()
    db.refresh(design)
    return design


@router.get("/mine", response_model=list[DesignSummary])
def my_designs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Design)
        .filter(Design.owner_id == user.id)
        .order_by(Design.updated_at.desc())
        .all()
    )


@router.get("/{design_id}", response_model=DesignOut)
def get_design(design_id: str, db: Session = Depends(get_db)):
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status_code=404, detail="Design not found")
    return design


@router.patch("/{design_id}", response_model=DesignOut)
def update_design(
    design_id: str,
    payload: DesignUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    design = _owned_or_404(design_id, db, user)
    if payload.title is not None:
        design.title = payload.title.strip() or None
    db.commit()
    db.refresh(design)
    return design


@router.delete("/{design_id}", status_code=204)
def delete_design(
    design_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    design = _owned_or_404(design_id, db, user)
    db.delete(design)
    db.commit()
    return Response(status_code=204)
