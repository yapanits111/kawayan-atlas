"""Kawayan Atlas API — FastAPI application entry point."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import calculator, designs, graphs, joints, species, templates

# For local dev / scaffolding this creates tables directly. On serverless (Vercel),
# skip it — the schema is created once by migrations / the local seed against Neon,
# so we avoid hitting the database on every cold start.
if not os.getenv("VERCEL"):
    Base.metadata.create_all(bind=engine)

# Optionally seed on startup (convenient for a first cloud deploy against an empty DB).
if settings.seed_on_startup:
    from .models import BambooSpecies
    from .seed import seed

    with SessionLocal() as _db:
        if _db.query(BambooSpecies).count() == 0:
            seed()

app = FastAPI(
    title="Kawayan Atlas API",
    description="Backend for the Kawayan Atlas bamboo-structures platform (Release 1).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(species.router)
app.include_router(joints.router)
app.include_router(templates.router)
app.include_router(designs.router)
app.include_router(graphs.router)
app.include_router(calculator.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "calculator_enabled": settings.calculator_enabled}
