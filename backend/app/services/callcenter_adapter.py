from __future__ import annotations

import json
import secrets
import urllib.error
import urllib.request
from dataclasses import dataclass

from app.core.config import Settings


class VoiceAdapterUnavailable(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class TranscriptResult:
    text: str
    language: str
    confidence: float
    engine: str


class CallcenterVoiceAdapter:
    """Thin adapter boundary for the separately deployed Callcentrai service.

    The concrete endpoint can be changed without coupling incident-core to the
    STT pipeline. Audio is never sent to a third-party cloud by this adapter.
    """

    def __init__(self, settings: Settings):
        self.base_url = settings.callcenter_base_url
        self.token = settings.callcenter_api_token

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    def transcribe(
        self,
        audio: bytes,
        filename: str,
        content_type: str,
        language_hint: str | None = None,
    ) -> TranscriptResult:
        if not self.base_url:
            raise VoiceAdapterUnavailable("Callcentrai adapter is not configured")
        boundary = f"----infra-signal-{secrets.token_hex(12)}"
        fields = []
        if language_hint:
            fields.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"language_hint\"\r\n\r\n{language_hint}\r\n".encode()
            )
        file_header = (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"audio\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode()
        body = b"".join(fields) + file_header + audio + f"\r\n--{boundary}--\r\n".encode()
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(
            f"{self.base_url}/api/v1/transcribe",
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            raise VoiceAdapterUnavailable(str(exc)) from exc
        text = str(payload.get("text") or payload.get("transcript") or "").strip()
        if not text:
            raise VoiceAdapterUnavailable("Callcentrai returned an empty transcript")
        return TranscriptResult(
            text=text,
            language=str(payload.get("language") or language_hint or "unknown"),
            confidence=float(payload.get("confidence") or 0.0),
            engine=str(payload.get("engine") or "callcentrai"),
        )
