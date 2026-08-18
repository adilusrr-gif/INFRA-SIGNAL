from __future__ import annotations

import os
from dataclasses import dataclass


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Infra Incident AI")
    app_env: str = os.getenv("APP_ENV", "development")
    allowed_origins: tuple[str, ...] = tuple(
        item.strip()
        for item in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8088"
        ).split(",")
        if item.strip()
    )
    enable_ollama: bool = _as_bool(os.getenv("ENABLE_OLLAMA"))
    ollama_base_url: str = os.getenv(
        "OLLAMA_BASE_URL", "http://host.docker.internal:11434"
    ).rstrip("/")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3.5:35b")
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "20"))
    callcenter_base_url: str = os.getenv("CALLCENTER_BASE_URL", "").rstrip("/")
    callcenter_api_token: str = os.getenv("CALLCENTER_API_TOKEN", "")
    kence_base_url: str = os.getenv("KENCE_BASE_URL", "").rstrip("/")
    kence_api_token: str = os.getenv("KENCE_API_TOKEN", "")
    kence_session_id: str = os.getenv("KENCE_SESSION_ID", "")
    kence_timeout_seconds: float = float(os.getenv("KENCE_TIMEOUT_SECONDS", "30"))


settings = Settings()
