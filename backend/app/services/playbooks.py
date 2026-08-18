from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from app.core.models import Incident, IncidentType, Recommendation


_TOKEN_RE = re.compile(r"[a-zа-яёәғқңөұүһі0-9-]+", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class PlaybookSection:
    incident_type: IncidentType
    source: str
    section: str
    title: str
    content: str
    actions: tuple[str, ...]


class PlaybookService:
    def __init__(self, data_path: Path | None = None):
        path = data_path or Path(__file__).resolve().parent.parent / "data" / "playbooks.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        self.sections = [
            PlaybookSection(
                incident_type=IncidentType(item["incident_type"]),
                source=item["source"],
                section=item["section"],
                title=item["title"],
                content=item["content"],
                actions=tuple(item["actions"]),
            )
            for item in payload
        ]

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return {token.lower().replace("ё", "е") for token in _TOKEN_RE.findall(text)}

    def retrieve(
        self, incident_type: IncidentType, query: str, top_k: int = 2
    ) -> list[PlaybookSection]:
        query_tokens = self._tokens(query)
        scored: list[tuple[float, PlaybookSection]] = []
        for section in self.sections:
            if section.incident_type not in {incident_type, IncidentType.UNKNOWN}:
                continue
            section_tokens = self._tokens(
                f"{section.title} {section.content} {' '.join(section.actions)}"
            )
            overlap = len(query_tokens & section_tokens)
            type_bonus = 5 if section.incident_type == incident_type else 0
            scored.append((overlap + type_bonus, section))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [section for _, section in scored[:top_k]]

    def recommendations_for(self, incident: Incident) -> list[Recommendation]:
        query = f"{incident.title} {incident.probable_cause}"
        sections = self.retrieve(incident.incident_type, query, top_k=2)
        recommendations: list[Recommendation] = []
        order = 1
        for section in sections:
            for action in section.actions:
                recommendations.append(
                    Recommendation(
                        order=order,
                        title=section.title,
                        action=action,
                        source=section.source,
                        section=section.section,
                    )
                )
                order += 1
                if order > 5:
                    return recommendations
        return recommendations
