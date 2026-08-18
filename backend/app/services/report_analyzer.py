from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.models import IncidentType, ReportLanguage


_WORD_RE = re.compile(r"[a-zа-яёәғқңөұүһі0-9-]+", re.IGNORECASE)
_KAZAKH_CHARS = set("әғқңөұүһі")

_CATEGORY_TERMS: dict[IncidentType, dict[str, int]] = {
    IncidentType.WATER_LEAK: {
        "течет": 4,
        "течь": 4,
        "утечка": 5,
        "прорвало": 5,
        "фонтан": 4,
        "лужа": 2,
        "вода на улице": 5,
        "су ағып": 5,
        "су кетіп": 4,
        "құбыр жарылды": 6,
        "су көшеде": 5,
        "су басып": 4,
    },
    IncidentType.LOW_WATER_PRESSURE: {
        "нет воды": 5,
        "слабый напор": 5,
        "низкое давление": 5,
        "вода пропала": 4,
        "су жоқ": 5,
        "су келмейді": 5,
        "қысым төмен": 5,
        "су әлсіз": 4,
    },
    IncidentType.HEATING_FAILURE: {
        "нет отопления": 6,
        "холодные батареи": 5,
        "нет тепла": 5,
        "жылу жоқ": 6,
        "батарея суық": 5,
        "үй суық": 4,
    },
    IncidentType.POWER_OUTAGE: {
        "нет света": 6,
        "отключили электричество": 6,
        "электричество пропало": 5,
        "жарық жоқ": 6,
        "электр қуаты жоқ": 6,
    },
    IncidentType.SEWER_FAILURE: {
        "канализация": 5,
        "колодец переполнен": 5,
        "запах канализации": 4,
        "кәріз": 6,
        "кәріз иісі": 5,
    },
}

_URGENT_TERMS: dict[str, int] = {
    "срочно": 18,
    "авария": 18,
    "опасно": 22,
    "дети": 10,
    "школа": 10,
    "больница": 18,
    "дорогу затопило": 15,
    "шұғыл": 18,
    "апат": 18,
    "қауіпті": 22,
    "балалар": 10,
    "мектеп": 10,
    "аурухана": 18,
}


@dataclass(frozen=True, slots=True)
class ReportAnalysis:
    language: ReportLanguage
    incident_type: IncidentType
    urgency_score: int
    summary: str
    matched_terms: tuple[str, ...]
    confidence: float


def normalize_text(text: str) -> str:
    return " ".join(text.lower().replace("ё", "е").split())


def detect_language(text: str) -> ReportLanguage:
    lowered = text.lower()
    kazakh_hits = sum(lowered.count(char) for char in _KAZAKH_CHARS)
    words = _WORD_RE.findall(lowered)
    russian_markers = {"нет", "течет", "вода", "срочно", "улица", "дом"}
    russian_hits = sum(word in russian_markers for word in words)
    if kazakh_hits and russian_hits:
        return ReportLanguage.MIXED
    if kazakh_hits:
        return ReportLanguage.KZ
    if words:
        return ReportLanguage.RU
    return ReportLanguage.UNKNOWN


def analyze_report(text: str) -> ReportAnalysis:
    normalized = normalize_text(text)
    category_scores: dict[IncidentType, int] = {}
    matched: list[str] = []
    for incident_type, terms in _CATEGORY_TERMS.items():
        score = 0
        for term, weight in terms.items():
            if term in normalized:
                score += weight
                matched.append(term)
        category_scores[incident_type] = score

    incident_type, best_score = max(category_scores.items(), key=lambda item: item[1])
    if best_score == 0:
        incident_type = IncidentType.UNKNOWN

    urgency = 25 if incident_type is not IncidentType.UNKNOWN else 10
    for term, weight in _URGENT_TERMS.items():
        if term in normalized:
            urgency += weight
            matched.append(term)
    if incident_type in {IncidentType.WATER_LEAK, IncidentType.HEATING_FAILURE}:
        urgency += 12
    urgency = max(0, min(100, urgency))

    summary = text.strip()
    if len(summary) > 180:
        summary = summary[:177].rstrip() + "..."
    confidence = 0.35 if best_score == 0 else min(0.96, 0.56 + best_score * 0.055)

    return ReportAnalysis(
        language=detect_language(text),
        incident_type=incident_type,
        urgency_score=urgency,
        summary=summary,
        matched_terms=tuple(dict.fromkeys(matched)),
        confidence=round(confidence, 2),
    )
