from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.core.models import IncidentType, ReportLanguage
from app.services.report_analyzer import ReportAnalysis, analyze_report


@dataclass(slots=True)
class OllamaStatus:
    enabled: bool
    available: bool
    model: str
    detail: str


class LocalReportAnalyzer:
    """Optional local-LLM enhancer with a deterministic safe fallback."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def analyze(self, text: str) -> ReportAnalysis:
        fallback = analyze_report(text)
        if not self.settings.enable_ollama:
            return fallback
        try:
            payload = self._call_ollama(text)
            return self._merge(payload, fallback)
        except (OSError, ValueError, KeyError, TimeoutError, urllib.error.URLError):
            return fallback

    def status(self) -> OllamaStatus:
        if not self.settings.enable_ollama:
            return OllamaStatus(False, False, self.settings.ollama_model, "disabled")
        try:
            request = urllib.request.Request(
                f"{self.settings.ollama_base_url}/api/tags", method="GET"
            )
            with urllib.request.urlopen(request, timeout=3) as response:
                available = response.status == 200
            return OllamaStatus(True, available, self.settings.ollama_model, "ok")
        except OSError as exc:
            return OllamaStatus(True, False, self.settings.ollama_model, str(exc))

    def _call_ollama(self, text: str) -> dict[str, Any]:
        allowed = [item.value for item in IncidentType]
        prompt = (
            "Проанализируй обращение о городской инфраструктуре на русском или "
            "казахском. Верни только JSON без markdown: "
            '{"incident_type":"...","urgency_score":0,"summary":"...",'
            '"language":"ru|kz|mixed","confidence":0.0}. '
            f"Допустимые incident_type: {allowed}. Обращение: {text}"
        )
        body = json.dumps(
            {
                "model": self.settings.ollama_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.0},
            },
            ensure_ascii=False,
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.settings.ollama_base_url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(
            request, timeout=self.settings.ollama_timeout_seconds
        ) as response:
            raw = json.loads(response.read().decode("utf-8"))
        return json.loads(raw["message"]["content"])

    @staticmethod
    def _merge(payload: dict[str, Any], fallback: ReportAnalysis) -> ReportAnalysis:
        try:
            incident_type = IncidentType(str(payload.get("incident_type")))
        except ValueError:
            incident_type = fallback.incident_type
        try:
            language = ReportLanguage(str(payload.get("language")))
        except ValueError:
            language = fallback.language
        try:
            urgency = max(0, min(100, int(payload.get("urgency_score", 0))))
        except (TypeError, ValueError):
            urgency = fallback.urgency_score
        try:
            confidence = max(0.0, min(0.98, float(payload.get("confidence", 0))))
        except (TypeError, ValueError):
            confidence = fallback.confidence
        summary = str(payload.get("summary") or fallback.summary)[:180]
        return ReportAnalysis(
            language=language,
            incident_type=(
                fallback.incident_type
                if incident_type is IncidentType.UNKNOWN
                else incident_type
            ),
            urgency_score=max(urgency, fallback.urgency_score),
            summary=summary,
            matched_terms=fallback.matched_terms,
            confidence=max(confidence, fallback.confidence),
        )
