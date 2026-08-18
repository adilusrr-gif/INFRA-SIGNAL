from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class AssetType(str, Enum):
    WATER_MAIN = "water_main"
    HEATING_MAIN = "heating_main"
    ELECTRIC_SUBSTATION = "electric_substation"
    SEWER_COLLECTOR = "sewer_collector"


class AssetState(str, Enum):
    NORMAL = "normal"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    OFFLINE = "offline"


class ReportChannel(str, Enum):
    WEB = "web"
    CALL_109 = "call_109"
    EOTINISH = "eotinish"
    TELEGRAM = "telegram"
    OPERATOR = "operator"


class ReportLanguage(str, Enum):
    RU = "ru"
    KZ = "kz"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class IncidentType(str, Enum):
    WATER_LEAK = "water_leak"
    LOW_WATER_PRESSURE = "low_water_pressure"
    HEATING_FAILURE = "heating_failure"
    POWER_OUTAGE = "power_outage"
    SEWER_FAILURE = "sewer_failure"
    UNKNOWN = "unknown"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, Enum):
    DETECTED = "detected"
    CONFIRMED = "confirmed"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    MONITORING = "monitoring"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class EvidenceKind(str, Enum):
    TELEMETRY = "telemetry"
    CITIZEN_REPORT = "citizen_report"
    VOICE_TRANSCRIPT = "voice_transcript"
    MAINTENANCE_HISTORY = "maintenance_history"
    WEATHER = "weather"


@dataclass(slots=True)
class InfrastructureAsset:
    id: str
    external_id: str
    name: str
    asset_type: AssetType
    latitude: float
    longitude: float
    commissioned_year: int
    district: str
    state: AssetState = AssetState.NORMAL
    criticality: int = 50
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class TelemetrySample:
    asset_id: str
    metric: str
    value: float
    unit: str
    captured_at: datetime
    source: str = "scada_simulator"
    id: str = field(default_factory=lambda: new_id("tel"))


@dataclass(slots=True)
class AnomalySignal:
    asset_id: str
    metric: str
    current_value: float
    baseline_value: float
    score: float
    direction: str
    reason: str
    detected_at: datetime
    id: str = field(default_factory=lambda: new_id("ano"))


@dataclass(slots=True)
class CitizenReport:
    text: str
    channel: ReportChannel
    latitude: float
    longitude: float
    address: str
    created_at: datetime
    language: ReportLanguage = ReportLanguage.UNKNOWN
    incident_type: IncidentType = IncidentType.UNKNOWN
    urgency_score: int = 0
    summary: str = ""
    source_reference: str | None = None
    id: str = field(default_factory=lambda: new_id("rep"))


@dataclass(slots=True)
class Evidence:
    kind: EvidenceKind
    source_id: str
    label: str
    detail: str
    observed_at: datetime
    weight: float
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: new_id("ev"))


@dataclass(slots=True)
class Recommendation:
    order: int
    title: str
    action: str
    source: str
    section: str
    requires_human_approval: bool = True
    id: str = field(default_factory=lambda: new_id("rec"))


@dataclass(slots=True)
class Crew:
    id: str
    name: str
    specialization: tuple[AssetType, ...]
    latitude: float
    longitude: float
    status: str = "available"
    phone: str = ""


@dataclass(slots=True)
class Incident:
    incident_type: IncidentType
    title: str
    asset_id: str
    latitude: float
    longitude: float
    detected_at: datetime
    severity: Severity = Severity.MEDIUM
    status: IncidentStatus = IncidentStatus.DETECTED
    risk_score: int = 0
    confidence: float = 0.0
    probable_cause: str = "Требуется проверка"
    affected_radius_meters: int = 250
    evidence: list[Evidence] = field(default_factory=list)
    recommendations: list[Recommendation] = field(default_factory=list)
    recommended_crew_id: str | None = None
    assigned_crew_id: str | None = None
    updated_at: datetime = field(default_factory=utcnow)
    id: str = field(default_factory=lambda: new_id("inc"))

    def add_evidence(self, item: Evidence) -> None:
        if any(existing.source_id == item.source_id for existing in self.evidence):
            return
        self.evidence.append(item)
        self.updated_at = utcnow()


@dataclass(slots=True)
class TimelineEvent:
    kind: str
    title: str
    detail: str
    happened_at: datetime
    related_id: str | None = None
    id: str = field(default_factory=lambda: new_id("evt"))


def to_dict(value: Any) -> Any:
    """Convert nested dataclasses, enums and datetimes to JSON-safe values."""

    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "__dataclass_fields__"):
        return {key: to_dict(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): to_dict(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_dict(item) for item in value]
    return value
