"""Centralized application configuration — single source of truth for deployment."""
import os
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
PROMPTS_DIR = REPO_ROOT / "prompts"

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://eight25-assessment.vercel.app",
]


def get_cors_origins() -> list[str]:
    extra = os.environ.get("CORS_ORIGINS", "")
    origins = list(DEFAULT_CORS_ORIGINS)
    if extra:
        origins.extend(o.strip() for o in extra.split(",") if o.strip())
    return list(dict.fromkeys(origins))


class Settings:
    """Reads from os.environ on each access so tests and runtime stay in sync."""

    @property
    def gemini_api_key(self) -> str:
        return os.environ.get("GEMINI_API_KEY", "")

    @property
    def openai_api_key(self) -> str:
        return os.environ.get("OPENAI_API_KEY", "")

    @property
    def openai_model_name(self) -> str:
        return os.environ.get("OPENAI_MODEL_NAME", "gpt-4o-mini")

    @property
    def gemini_model_name(self) -> str:
        return os.environ.get("GEMINI_MODEL_NAME", "gemini-2.0-flash")

    @property
    def database_url(self) -> str:
        return os.environ.get("DATABASE_URL", "sqlite:///./webcrawler.db")

    @property
    def jwt_secret_key(self) -> str:
        return os.environ.get(
            "JWT_SECRET_KEY",
            "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        )

    @property
    def cors_origins(self) -> list[str]:
        return get_cors_origins()

    @property
    def llm_max_retries(self) -> int:
        return int(os.environ.get("LLM_MAX_RETRIES", "2"))

    prompts_dir: Path = PROMPTS_DIR


settings = Settings()
