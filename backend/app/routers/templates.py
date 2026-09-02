"""Template gallery endpoints — list (with filtering) and detail."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Template
from ..schemas import TemplateOut

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    category: str | None = Query(default=None, description="Filter by category"),
):
    stmt = select(Template).order_by(Template.name)
    if category:
        stmt = stmt.where(Template.category == category)
    return db.execute(stmt).scalars().all()


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = db.get(Template, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template
