from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "U2App Migrated Backend"
    environment: str = "development"
    log_level: str = "INFO"
    allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:4200",
            "https://localhost:4200",
            "http://127.0.0.1:4200",
            "https://127.0.0.1:4200",
        ]
    )
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/u2app"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1/"
    speech_model: str = "gpt-4o-mini-tts"
    default_voice: str = "coral"
    admin_username: str = "admin"
    admin_password: str = "ChangeMeNow!"
    jwt_secret_key: str = "replace-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
