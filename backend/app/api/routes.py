from __future__ import annotations

import asyncio
from dataclasses import asdict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.schemas import (
    AssignCrewIn,
    KenceGuidanceIn,
    ReportIn,
    StatusIn,
    TelemetryIn,
    VoiceTranscriptIn,
)
from app.core.models import CitizenReport, ReportChannel, TelemetrySample, to_dict, utcnow
from app.services.callcenter_adapter import CallcenterVoiceAdapter, VoiceAdapterUnavailable
from app.services.engine import IncidentIntelligenceService
from app.services.gis_import import GisImportValidationError, import_gis_assets
from app.services.kence_adapter import KenceAdapterUnavailable, KenceGuidanceAdapter
from app.services.simulation import reset_demo, run_water_leak_scenario


def build_router(service: IncidentIntelligenceService) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    voice_adapter = CallcenterVoiceAdapter(service.settings)
    kence_adapter = KenceGuidanceAdapter(service.settings)

    @router.get("/health")
    def health() -> dict:
        ai = service.report_analyzer.status()
        return {
            "status": "ok",
            "service": "infra-incident-ai",
            "deterministic_core": True,
            "ollama": to_dict(ai),
            "integrations": {
                "callcentrai": {"configured": voice_adapter.configured},
                "gis_import": {
                    "configured": True,
                    "formats": ["csv", "geojson"],
                },
                "kence": {"configured": kence_adapter.configured},
            },
        }

    @router.get("/dashboard")
    def dashboard() -> dict:
        return service.dashboard()

    @router.post("/demo/reset")
    def demo_reset() -> dict:
        return reset_demo(service)

    @router.post("/demo/water-leak")
    def demo_water_leak() -> dict:
        return run_water_leak_scenario(service)

    @router.post("/integrations/gis/import")
    async def import_gis_registry(
        file: UploadFile = File(...),
        dry_run: bool = Form(default=True),
    ) -> dict:
        content = await file.read(5 * 1024 * 1024 + 1)
        if not content:
            raise HTTPException(status_code=400, detail="GIS file is empty")
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="GIS file must not exceed 5 MB")
        try:
            result = import_gis_assets(
                content=content,
                filename=file.filename or "assets",
                content_type=file.content_type,
                store=service.store,
                dry_run=dry_run,
            )
        except GisImportValidationError as exc:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "GIS import validation failed; no changes were applied",
                    "issues": [asdict(issue) for issue in exc.issues[:100]],
                },
            ) from exc
        return asdict(result)

    @router.post("/telemetry")
    def ingest_telemetry(payload: TelemetryIn) -> dict:
        if payload.asset_id not in service.store.assets:
            raise HTTPException(status_code=404, detail="Infrastructure asset not found")
        sample = TelemetrySample(
            asset_id=payload.asset_id,
            metric=payload.metric,
            value=payload.value,
            unit=payload.unit,
            captured_at=payload.captured_at or utcnow(),
            source=payload.source,
        )
        incident = service.ingest_telemetry(sample)
        return {"sample": to_dict(sample), "incident": to_dict(incident) if incident else None}

    @router.post("/reports")
    def ingest_report(payload: ReportIn) -> dict:
        report = CitizenReport(
            text=payload.text,
            channel=payload.channel,
            latitude=payload.latitude,
            longitude=payload.longitude,
            address=payload.address,
            created_at=payload.created_at or utcnow(),
            source_reference=payload.source_reference,
        )
        incident = service.ingest_report(report)
        return {"report": to_dict(report), "incident": to_dict(incident) if incident else None}

    @router.post("/reports/voice-transcript")
    def ingest_voice_transcript(payload: VoiceTranscriptIn) -> dict:
        report = CitizenReport(
            text=payload.transcript,
            channel=ReportChannel.CALL_109,
            latitude=payload.latitude,
            longitude=payload.longitude,
            address=payload.address,
            created_at=payload.created_at or utcnow(),
            source_reference=payload.call_id,
        )
        incident = service.ingest_report(report)
        return {"report": to_dict(report), "incident": to_dict(incident) if incident else None}

    @router.post("/reports/voice-audio")
    async def ingest_voice_audio(
        audio: UploadFile = File(...),
        latitude: float = Form(...),
        longitude: float = Form(...),
        address: str = Form(...),
        call_id: str | None = Form(default=None),
        language_hint: str | None = Form(default=None),
    ) -> dict:
        if not voice_adapter.configured:
            raise HTTPException(status_code=503, detail="Callcentrai adapter is not configured")
        content = await audio.read()
        if not content or len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio must be between 1 byte and 20 MB")
        try:
            transcript = await asyncio.to_thread(
                voice_adapter.transcribe,
                content,
                audio.filename or "voice.wav",
                audio.content_type or "application/octet-stream",
                language_hint,
            )
        except VoiceAdapterUnavailable as exc:
            raise HTTPException(status_code=502, detail="Voice adapter unavailable") from exc
        report = CitizenReport(
            text=transcript.text,
            channel=ReportChannel.CALL_109,
            latitude=latitude,
            longitude=longitude,
            address=address,
            created_at=utcnow(),
            source_reference=call_id,
        )
        incident = service.ingest_report(report)
        return {
            "transcript": to_dict(transcript),
            "report": to_dict(report),
            "incident": to_dict(incident) if incident else None,
        }

    @router.post("/guidance/kence")
    async def kence_guidance(payload: KenceGuidanceIn) -> dict:
        if not kence_adapter.configured:
            raise HTTPException(status_code=503, detail="KENCE adapter is not configured")
        try:
            guidance = await asyncio.to_thread(
                kence_adapter.ask,
                payload.question,
                payload.language,
            )
        except KenceAdapterUnavailable as exc:
            raise HTTPException(status_code=502, detail="KENCE adapter unavailable") from exc
        return to_dict(guidance)

    @router.get("/incidents/{incident_id}")
    def get_incident(incident_id: str) -> dict:
        incident = service.store.incidents.get(incident_id)
        if incident is None:
            raise HTTPException(status_code=404, detail="Incident not found")
        return to_dict(incident)

    @router.patch("/incidents/{incident_id}/status")
    def update_status(incident_id: str, payload: StatusIn) -> dict:
        if incident_id not in service.store.incidents:
            raise HTTPException(status_code=404, detail="Incident not found")
        return to_dict(service.update_status(incident_id, payload.status))

    @router.post("/incidents/{incident_id}/assign")
    def assign_crew(incident_id: str, payload: AssignCrewIn) -> dict:
        if incident_id not in service.store.incidents:
            raise HTTPException(status_code=404, detail="Incident not found")
        if payload.crew_id not in service.store.crews:
            raise HTTPException(status_code=404, detail="Crew not found")
        return to_dict(service.assign_crew(incident_id, payload.crew_id))

    return router
