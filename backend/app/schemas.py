"""Pydantic schemas — API request/response shapes, decoupled from ORM models."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SpeciesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name_local: str
    name_scientific: str
    region: str
    density: str
    culm_diam_range: str
    wall_thickness_range: str
    treatment_methods: list[str]
    structural_role: list[str]
    description: str
    image_url: str | None
    sources: list[str]


class JointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    applicable_species: list[str]
    applicable_culm_sizes: str
    load_notes: str
    failure_mode: str
    media_url: str | None
    sources: list[str]


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    description: str
    version: str
    components: list[dict]
    default_bom: list[dict]
    known_span_range: str
    hero_image: str | None


class DesignParams(BaseModel):
    """Studio design parameters, validated with the same bounds as the UI sliders.
    Unknown keys are ignored rather than rejected, so the shape can grow safely."""

    model_config = ConfigDict(extra="ignore")

    species_id: str | None = Field(default=None, max_length=64)
    roof: Literal["gable", "hip", "flat"] | None = None
    bracing: Literal["none", "knee", "cross"] | None = None
    door: bool | None = None
    bays: int | None = Field(default=None, ge=1, le=6)
    width: float | None = Field(default=None, gt=0, le=20)
    bayLength: float | None = Field(default=None, gt=0, le=10)
    floorHeight: float | None = Field(default=None, ge=0, le=6)
    wallHeight: float | None = Field(default=None, gt=0, le=8)
    roofPitch: float | None = Field(default=None, ge=0, le=6)


class DesignComponentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str = Field(max_length=32)
    species_id: str | None = Field(default=None, max_length=64)
    joint_id: str | None = Field(default=None, max_length=64)


class DesignCreate(BaseModel):
    based_on_template_id: str | None = Field(default=None, max_length=64)
    based_on_template_version: str | None = None  # ignored on input; server stamps it
    components: list[DesignComponentIn] = Field(default_factory=list, max_length=50)
    params: DesignParams = Field(default_factory=DesignParams)


class DesignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    based_on_template_id: str | None
    based_on_template_version: str | None
    components: list[dict]
    params: dict
    created_at: datetime
    updated_at: datetime


# --- Calculator (gated OFF until SME review; see PLAN.md 3E/3F/7) ---


class CalcRequest(BaseModel):
    species_id: str
    diameter_mm: float
    wall_thickness_mm: float
    span_m: float
    spacing_m: float = 0.6


class CalcResult(BaseModel):
    enabled: bool
    disclaimer: str
    inputs: CalcRequest | None = None
    # Populated only when the calculator is enabled and reviewed.
    axial_capacity_kn: float | None = None
    bending_capacity_knm: float | None = None
    safety_factor: float | None = None
    flags: list[str] = []
