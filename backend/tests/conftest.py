"""Pytest fixtures: an isolated SQLite database, seeded once per session.

The DATABASE_URL env var is set BEFORE importing the app so its engine binds to a
throwaway temp database rather than the dev kawayan.db. Env vars take precedence over
any .env file in pydantic-settings, so this reliably isolates tests.
"""
import os
import pathlib
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="kawayan-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{pathlib.Path(_tmp_dir).as_posix()}/test.db"
os.environ["CALCULATOR_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _prepare_db():
    Base.metadata.create_all(bind=engine)
    seed()
    yield


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
