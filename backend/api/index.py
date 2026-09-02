"""Vercel serverless entry point — exposes the FastAPI ASGI app.

Vercel's @vercel/python runtime detects the `app` ASGI object and serves it.
All routes are sent here via vercel.json.
"""
from app.main import app  # noqa: F401
