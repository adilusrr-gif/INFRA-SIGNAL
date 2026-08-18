from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import build_router
from app.core.config import settings
from app.services.engine import IncidentIntelligenceService
from app.services.simulation import reset_demo


service = IncidentIntelligenceService()


@asynccontextmanager
async def lifespan(_: FastAPI):
    reset_demo(service)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Local AI early-warning layer for municipal utility incidents.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)
app.include_router(build_router(service))


@app.get("/")
def root() -> dict:
    return {"service": "infra-incident-ai", "docs": "/docs", "health": "/api/v1/health"}
