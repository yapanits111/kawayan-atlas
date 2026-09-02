"""Single-member structural calculator.

GATED OFF by default. This endpoint returns nothing but a disclaimer until
`CALCULATOR_ENABLED=true` AND a licensed engineer (SME) has reviewed the numeric
rules below. See PLAN.md sections 3E, 3F, and 7 — structural outputs must not reach
users on disclaimers alone.

The formulas below are PLACEHOLDERS and must not be trusted or shipped as-is.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import BambooSpecies
from ..schemas import CalcRequest, CalcResult

router = APIRouter(prefix="/api/calculator", tags=["calculator"])

DISCLAIMER = (
    "Estimate only — NOT a stamped structural calculation. This tool does not "
    "replace a licensed structural engineer or the LGU building-permit process. "
    "Outputs are advisory and must be verified by a qualified professional."
)


@router.post("/single-member", response_model=CalcResult)
def single_member(req: CalcRequest, db: Session = Depends(get_db)):
    if not settings.calculator_enabled:
        # Gate: return the disclaimer and nothing else.
        return CalcResult(enabled=False, disclaimer=DISCLAIMER)

    species = db.get(BambooSpecies, req.species_id)
    if species is None:
        raise HTTPException(status_code=404, detail="Species not found")

    # ---------------------------------------------------------------
    # [PLACEHOLDER — needs SME verification] Do NOT trust these numbers.
    # Real values require ISO 22156 design provisions + graded material
    # properties reviewed by a structural engineer.
    # ---------------------------------------------------------------
    flags: list[str] = ["[PLACEHOLDER] Formulas are unverified and for scaffolding only."]

    slenderness = req.span_m * 1000 / max(req.diameter_mm, 1)
    if slenderness > 30:
        flags.append("Span-to-diameter ratio is high; check for buckling / add bracing.")

    return CalcResult(
        enabled=True,
        disclaimer=DISCLAIMER,
        inputs=req,
        axial_capacity_kn=None,
        bending_capacity_knm=None,
        safety_factor=None,
        flags=flags,
    )
