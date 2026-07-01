import os
from typing import List, Optional

# pydantic v2 moved BaseSettings to the `pydantic-settings` package. Try
# to import the new location first; if not available, fall back to older
# pydantic import. If neither is present, provide a lightweight fallback
# that reads environment variables directly so the app can still run.
try:
    from pydantic_settings import BaseSettings  # type: ignore
    _HAS_PYDANTIC_SETTINGS = True
except Exception:
    try:
        from pydantic import BaseSettings  # type: ignore
        _HAS_PYDANTIC_SETTINGS = True
    except Exception:
        _HAS_PYDANTIC_SETTINGS = False


if _HAS_PYDANTIC_SETTINGS:
    class Settings(BaseSettings):
        APP_NAME: str = "Sight Word Tracker API"
        DEBUG: bool = False

        # CORS origins may include http(s) addresses; prefer explicit production origins.
        # Avoid wildcards in production and set ALLOWED_ORIGINS in env for deployed domains.
        ALLOWED_ORIGINS: Optional[str] = "http://localhost:8000"
        FORCE_HTTPS: bool = False

        # Database connection parts (keep for backward compatibility with existing envs)
        DB_HOST: str = "localhost"
        DB_PORT: int = 3306
        DB_USER: str = "cloyd"
        DB_PASSWORD: str = "813617"
        # Shared password gate: when set, write/mutate API requests must present this value
        SHARED_PASSWORD: Optional[str] = None
        DB_NAME: str = "sightword_db"

        @property
        def database_url(self) -> str:
            # Compose a SQLAlchemy-compatible URL for MySQL using pymysql
            return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"

        @property
        def allowed_origins_list(self) -> List[str]:
            if not self.ALLOWED_ORIGINS:
                return []
            return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

        class Config:
            env_file = ".env"
            case_sensitive = True


    # Instantiate the settings singleton for import/use across the app
    settings = Settings()
else:
    # Minimal fallback settings implementation when pydantic isn't available.
    class Settings:
        def __init__(self):
            self.APP_NAME = os.getenv("APP_NAME", "Sight Word Tracker API")
            self.DEBUG = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")
            self.ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
            self.DB_HOST = os.getenv("DB_HOST", "localhost")
            try:
                self.DB_PORT = int(os.getenv("DB_PORT", "3306"))
            except Exception:
                self.DB_PORT = 3306
            self.DB_USER = os.getenv("DB_USER", "cloyd")
            self.DB_PASSWORD = os.getenv("DB_PASSWORD", "813617")
            self.SHARED_PASSWORD = os.getenv("SHARED_PASSWORD")
            self.DB_NAME = os.getenv("DB_NAME", "sightword_db")
            self.FORCE_HTTPS = os.getenv("FORCE_HTTPS", "false").lower() in ("1", "true", "yes")

        @property
        def database_url(self) -> str:
            return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"

        @property
        def allowed_origins_list(self) -> List[str]:
            if not self.ALLOWED_ORIGINS:
                return []
            return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


    settings = Settings()

