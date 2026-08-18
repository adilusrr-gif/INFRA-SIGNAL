from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.core.config import Settings


class KenceAdapterUnavailable(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class KenceGuidance:
    answer: str
    session_id: str
    source: str = "KENCE.AI"


class KenceGuidanceAdapter:
    """Optional boundary to a separately deployed KENCE knowledge session.

    KENCE stays the document/RAG product. This service only asks a configured
    session for additional operator guidance; it never delegates telemetry
    anomaly math, incident scoring or crew assignment to KENCE or an LLM.
    """

    def __init__(self, settings: Settings):
        self.base_url = settings.kence_base_url
        self.token = settings.kence_api_token
        self.session_id = settings.kence_session_id
        self.timeout_seconds = settings.kence_timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token and self.session_id)

    def ask(self, question: str, language: str = "ru") -> KenceGuidance:
        if not self.configured:
            raise KenceAdapterUnavailable("KENCE adapter is not configured")
        body = json.dumps(
            {
                "session_id": self.session_id,
                "question": question,
                "language": language,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=body,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(
                request, timeout=self.timeout_seconds
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            raise KenceAdapterUnavailable(str(exc)) from exc
        answer = str(payload.get("answer") or "").strip()
        if not answer:
            raise KenceAdapterUnavailable("KENCE returned an empty answer")
        return KenceGuidance(
            answer=answer,
            session_id=str(payload.get("session_id") or self.session_id),
        )
