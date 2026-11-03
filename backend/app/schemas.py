import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Credentials(Input):
    email: str = Field(max_length=254)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("请输入有效邮箱")
        return value.lower()


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=80)


class ProjectInput(Input):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class TaskInput(Input):
    title: str = Field(min_length=2, max_length=200)
    instructions: str = Field(default="", max_length=5000)
    language: Literal["zh", "en"] = "zh"
    report_type: Literal["research", "review", "brief"] = "research"
    web_enabled: bool = False
    max_rounds: int = Field(default=3, ge=1, le=6)


class ReportInput(Input):
    expected_version: int = Field(ge=1)
    content: str = Field(min_length=1, max_length=200000)


class UserUpdate(Input):
    role: Literal["admin", "member"] | None = None
    is_active: bool | None = None


class SettingsInput(Input):
    llm_base_url: str = Field(default="https://api.openai.com/v1", max_length=500)
    llm_model: str = Field(default="gpt-4.1-mini", min_length=1, max_length=100)
    embedding_model: str = Field(default="", max_length=100)
    search_provider: Literal["tavily"] = "tavily"
    search_max_results: int = Field(default=5, ge=1, le=10)
    max_upload_mb: int = Field(default=20, ge=1, le=100)

    @field_validator("llm_base_url")
    @classmethod
    def url_valid(cls, value):
        from urllib.parse import urlparse

        parsed = urlparse(value)
        if (
            parsed.scheme not in ("https", "http")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("模型地址需为无凭据的 HTTP(S) API 地址")
        return value.rstrip("/")
