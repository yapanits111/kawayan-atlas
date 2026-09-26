"""Application settings, loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict

# Signing key used when none is configured. Auth tokens are stateless HMACs, so anyone who
# knows this value can mint a token for any account — it is only ever safe on a developer's
# machine. `assert_secret_key_is_safe()` refuses to start a deployment that still uses it.
INSECURE_DEFAULT_SECRET = "dev-insecure-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local dev default: SQLite (no external service needed).
    # Deployment: set DATABASE_URL to a Neon Postgres connection string.
    database_url: str = "sqlite:///./kawayan.db"

    # CORS: comma-separated origins allowed to call the API.
    cors_origins: str = "http://localhost:3000"

    # The structural calculator is gated OFF until an SME reviews the numbers.
    calculator_enabled: bool = False

    # When true, seed the database on startup if it's empty. Handy for a first
    # cloud deploy so you don't need a separate one-off seed command.
    seed_on_startup: bool = False

    # Secret used to sign auth tokens (Release 2 accounts). MUST be overridden in
    # production via the SECRET_KEY env var; the default is for local dev only.
    secret_key: str = INSECURE_DEFAULT_SECRET
    # Bearer-token lifetime — 30 days, so a login persists comfortably.
    token_ttl_seconds: int = 60 * 60 * 24 * 30

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def uses_insecure_default_secret(self) -> bool:
        return self.secret_key == INSECURE_DEFAULT_SECRET


settings = Settings()


def assert_secret_key_is_safe() -> None:
    """Refuse to serve a deployment that still signs tokens with the published default.

    Anyone reading the repository knows that key, and tokens are stateless — so a deployed
    instance using it would let an attacker forge a session for any account. A deployment is
    detected via the platform's own marker (Vercel) or an explicit ENVIRONMENT=production.
    Locally we only warn, so `uvicorn app.main:app` still works with zero configuration.
    """
    if not settings.uses_insecure_default_secret:
        return
    import os
    import warnings

    deployed = bool(os.getenv("VERCEL")) or os.getenv("ENVIRONMENT", "").lower() in {
        "production",
        "prod",
        "staging",
    }
    message = (
        "SECRET_KEY is unset, so auth tokens are signed with the public development "
        "default. Set SECRET_KEY to a long random value."
    )
    if deployed:
        raise RuntimeError(f"Refusing to start: {message}")
    warnings.warn(f"{message} (development only)", stacklevel=2)
