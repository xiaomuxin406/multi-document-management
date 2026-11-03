from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = f"sqlite:///{(ROOT / 'data' / 'workspace.db').as_posix()}"
    data_dir: Path = ROOT / "data"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4.1-mini"
    llm_timeout_seconds: float = Field(default=90, ge=10, le=300)
    # Provider-specific parameter: omit unless explicitly configured.
    llm_enable_thinking: bool | None = None
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = ""
    tavily_api_key: str = ""
    cookie_secure: bool = False
    session_days: int = 7
    max_upload_mb: int = 20
    max_project_chunks: int = 20000
    trusted_origins: str = "http://127.0.0.1:5173,http://localhost:5173"


def public_defaults(settings):
    return dict(
        llm_base_url=settings.llm_base_url,
        llm_model=settings.llm_model,
        embedding_model=settings.embedding_model,
        search_provider="tavily",
        search_max_results=5,
        max_upload_mb=settings.max_upload_mb,
    )
