"""Application settings, loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
