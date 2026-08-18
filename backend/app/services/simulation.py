from __future__ import annotations

from datetime import timedelta

from app.core.models import (
    AssetType,
    CitizenReport,
    Crew,
    InfrastructureAsset,
    ReportChannel,
    TelemetrySample,
    TimelineEvent,
    utcnow,
)
from app.services.engine import IncidentIntelligenceService


def seed_reference_data(service: IncidentIntelligenceService) -> None:
    store = service.store
    store.add_asset(
        InfrastructureAsset(
            id="asset_water_042",
            external_id="WM-KOK-042",
            name="Водопроводная магистраль · участок 42",
            asset_type=AssetType.WATER_MAIN,
            latitude=53.28735,
            longitude=69.38965,
            commissioned_year=1989,
            district="Кокшетау · Центральный",
            criticality=88,
            properties={"diameter_mm": 500, "material": "steel", "length_m": 1260},
        )
    )
    store.add_asset(
        InfrastructureAsset(
            id="asset_heat_017",
            external_id="HT-KOK-017",
            name="Тепловая сеть · контур 17",
            asset_type=AssetType.HEATING_MAIN,
            latitude=53.2821,
            longitude=69.3984,
            commissioned_year=2004,
            district="Кокшетау · Центральный",
            criticality=76,
            properties={"diameter_mm": 300, "insulation": "PIR"},
        )
    )
    store.add_asset(
        InfrastructureAsset(
            id="asset_power_009",
            external_id="ES-KOK-009",
            name="Распределительная подстанция · 9",
            asset_type=AssetType.ELECTRIC_SUBSTATION,
            latitude=53.2918,
            longitude=69.4021,
            commissioned_year=2011,
            district="Кокшетау · Сарыарқа",
            criticality=82,
            properties={"capacity_mva": 25},
        )
    )
    store.add_crew(
        Crew(
            id="crew_water_1",
            name="Аварийная бригада водоканала №1",
            specialization=(AssetType.WATER_MAIN, AssetType.SEWER_COLLECTOR),
            latitude=53.2842,
            longitude=69.3812,
            phone="109-201",
        )
    )
    store.add_crew(
        Crew(
            id="crew_heat_2",
            name="Теплотехническая бригада №2",
            specialization=(AssetType.HEATING_MAIN,),
            latitude=53.2785,
            longitude=69.4055,
            phone="109-302",
        )
    )


def reset_demo(service: IncidentIntelligenceService) -> dict:
    service.store.reset()
    seed_reference_data(service)
    service.store.add_event(
        TimelineEvent(
            kind="system",
            title="Демонстрационный контур готов",
            detail="3 объекта и 2 аварийные бригады загружены",
            happened_at=utcnow(),
        )
    )
    return service.dashboard()


def run_water_leak_scenario(service: IncidentIntelligenceService) -> dict:
    service.store.reset()
    seed_reference_data(service)
    base = utcnow() - timedelta(minutes=24)
    baseline_values = [4.22, 4.18, 4.24, 4.21, 4.19, 4.23, 4.20, 4.25, 4.18, 4.22, 4.21, 4.20]
    for index, value in enumerate(baseline_values):
        service.ingest_telemetry(
            TelemetrySample(
                asset_id="asset_water_042",
                metric="pressure",
                value=value,
                unit="bar",
                captured_at=base + timedelta(minutes=index),
            )
        )
    service.store.add_event(
        TimelineEvent(
            kind="baseline",
            title="Базовый режим рассчитан",
            detail="Медианное давление 4.21 bar; 12 контрольных измерений",
            happened_at=base + timedelta(minutes=12),
            related_id="asset_water_042",
        )
    )

    service.ingest_telemetry(
        TelemetrySample(
            asset_id="asset_water_042",
            metric="pressure",
            value=3.62,
            unit="bar",
            captured_at=base + timedelta(minutes=13),
        )
    )
    service.ingest_report(
        CitizenReport(
            text="На улице Абая возле дома 74 слабый напор, вода почти не идет.",
            channel=ReportChannel.WEB,
            latitude=53.2877,
            longitude=69.3902,
            address="ул. Абая, 74",
            created_at=base + timedelta(minutes=14),
        )
    )
    service.ingest_telemetry(
        TelemetrySample(
            asset_id="asset_water_042",
            metric="pressure",
            value=2.74,
            unit="bar",
            captured_at=base + timedelta(minutes=15),
        )
    )
    service.ingest_report(
        CitizenReport(
            text="Абай көшесі 76 үйдің жанында құбыр жарылды, су көшеде ағып жатыр. Шұғыл!",
            channel=ReportChannel.CALL_109,
            latitude=53.2872,
            longitude=69.3892,
            address="Абай көшесі, 76",
            created_at=base + timedelta(minutes=16),
            source_reference="CALL-DEMO-001",
        )
    )
    service.ingest_report(
        CitizenReport(
            text="Сильная утечка воды у перекрестка Абая — Ауэзова, дорогу затопило.",
            channel=ReportChannel.EOTINISH,
            latitude=53.2869,
            longitude=69.3900,
            address="перекрёсток Абая — Ауэзова",
            created_at=base + timedelta(minutes=17),
            source_reference="EOT-DEMO-042",
        )
    )
    service.ingest_telemetry(
        TelemetrySample(
            asset_id="asset_water_042",
            metric="pressure",
            value=1.92,
            unit="bar",
            captured_at=base + timedelta(minutes=18),
        )
    )
    return service.dashboard()
