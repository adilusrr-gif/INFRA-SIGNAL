from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.models import IncidentStatus, ReportChannel


class TelemetryIn(BaseModel):
    asset_id: str
    metric: str = Field(min_length=2, max_length=40)
    value: float
    unit: str = Field(min_length=1, max_length=20)
    captured_at: datetime | None = None
    source: str = Field(default="scada_api", max_length=80)


class ReportIn(BaseModel):
    text: str = Field(min_length=5, max_length=4_000)
    channel: ReportChannel = ReportChannel.OPERATOR
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str = Field(min_length=3, max_length=300)
    created_at: datetime | None = None
    source_reference: str | None = Field(default=None, max_length=120)


class VoiceTranscriptIn(BaseModel):
    transcript: str = Field(min_length=5, max_length=4_000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str = Field(min_length=3, max_length=300)
    call_id: str | None = Field(default=None, max_length=120)
    created_at: datetime | None = None


class AssignCrewIn(BaseModel):
    crew_id: str


class StatusIn(BaseModel):
    status: IncidentStatus


class KenceGuidanceIn(BaseModel):
    question: str = Field(min_length=5, max_length=2_000)
    language: Literal["ru", "kz", "en"] = "ru"
