from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.models import (
    AssetState,
    AssetType,
    InfrastructureAsset,
    TimelineEvent,
    to_dict,
)
from app.services.store import InMemoryStore


MAX_GIS_ASSETS = 5_000
SUPPORTED_SUFFIXES = {".csv": "csv", ".geojson": "geojson", ".json": "geojson"}
RESERVED_FIELDS = {
    "external_id",
    "name",
    "asset_type",
    "latitude",
    "longitude",
    "commissioned_year",
    "district",
    "state",
    "criticality",
    "properties",
}


@dataclass(slots=True, frozen=True)
class GisImportIssue:
    row: str
    field: str
    message: str


class GisImportValidationError(ValueError):
    def __init__(self, issues: list[GisImportIssue]):
        super().__init__("GIS import validation failed")
        self.issues = issues


@dataclass(slots=True)
class GisImportResult:
    valid: bool
    source_format: str
    source_filename: str
    dry_run: bool
    received: int
    created: int
    updated: int
    unchanged: int
    applied: bool
    sample: list[dict[str, Any]] = field(default_factory=list)


def import_gis_assets(
    *,
    content: bytes,
    filename: str,
    content_type: str | None,
    store: InMemoryStore,
    dry_run: bool = True,
) -> GisImportResult:
    source_filename = Path(filename or "assets").name[:255]
    source_format = _detect_format(source_filename, content_type)
    records = (
        _read_csv(content)
        if source_format == "csv"
        else _read_geojson(content)
    )
    issues: list[GisImportIssue] = []
    if not records:
        issues.append(GisImportIssue(row="file", field="records", message="No assets found"))
    if len(records) > MAX_GIS_ASSETS:
        issues.append(
            GisImportIssue(
                row="file",
                field="records",
                message=f"Maximum {MAX_GIS_ASSETS} assets per import",
            )
        )

    assets: list[InfrastructureAsset] = []
    seen_external_ids: set[str] = set()
    for row, record in records:
        try:
            asset = _asset_from_record(record, row)
        except GisImportValidationError as exc:
            issues.extend(exc.issues)
            continue
        if asset.external_id in seen_external_ids:
            issues.append(
                GisImportIssue(
                    row=row,
                    field="external_id",
                    message=f"Duplicate external_id: {asset.external_id}",
                )
            )
            continue
        seen_external_ids.add(asset.external_id)
        assets.append(asset)

    if issues:
        raise GisImportValidationError(issues)

    existing = {item.external_id: item for item in store.list_assets()}
    created = updated = unchanged = 0
    for asset in assets:
        current = existing.get(asset.external_id)
        if current is None:
            created += 1
        else:
            asset.id = current.id
            if current == asset:
                unchanged += 1
            else:
                updated += 1

    if not dry_run:
        outcomes = store.upsert_assets(assets)
        created = outcomes.count("created")
        updated = outcomes.count("updated")
        unchanged = outcomes.count("unchanged")
        store.add_event(
            TimelineEvent(
                kind="gis_import",
                title="Реестр инфраструктуры обновлён",
                detail=(
                    f"{source_filename}: создано {created}, обновлено {updated}, "
                    f"без изменений {unchanged}"
                ),
                happened_at=datetime.now(timezone.utc),
            )
        )

    return GisImportResult(
        valid=True,
        source_format=source_format,
        source_filename=source_filename,
        dry_run=dry_run,
        received=len(assets),
        created=created,
        updated=updated,
        unchanged=unchanged,
        applied=not dry_run,
        sample=[to_dict(item) for item in assets[:10]],
    )


def _detect_format(filename: str, content_type: str | None) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in SUPPORTED_SUFFIXES:
        return SUPPORTED_SUFFIXES[suffix]
    normalized_type = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized_type in {"text/csv", "application/csv"}:
        return "csv"
    if normalized_type in {"application/json", "application/geo+json"}:
        return "geojson"
    raise GisImportValidationError(
        [
            GisImportIssue(
                row="file",
                field="format",
                message="Supported formats: .csv, .geojson and GeoJSON .json",
            )
        ]
    )


def _read_csv(content: bytes) -> list[tuple[str, dict[str, Any]]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise GisImportValidationError(
            [GisImportIssue(row="file", field="encoding", message="CSV must be UTF-8")]
        ) from exc
    try:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise GisImportValidationError(
                [GisImportIssue(row="file", field="header", message="CSV header is required")]
            )
        return [
            (f"csv:{index}", {str(key).strip(): value for key, value in row.items() if key})
            for index, row in enumerate(reader, start=2)
        ]
    except csv.Error as exc:
        raise GisImportValidationError(
            [GisImportIssue(row="file", field="csv", message=str(exc))]
        ) from exc


def _read_geojson(content: bytes) -> list[tuple[str, dict[str, Any]]]:
    try:
        payload = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GisImportValidationError(
            [GisImportIssue(row="file", field="json", message="Invalid UTF-8 GeoJSON")]
        ) from exc
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise GisImportValidationError(
            [
                GisImportIssue(
                    row="file",
                    field="type",
                    message="GeoJSON root must be a FeatureCollection",
                )
            ]
        )
    features = payload.get("features")
    if not isinstance(features, list):
        raise GisImportValidationError(
            [GisImportIssue(row="file", field="features", message="features must be an array")]
        )
    records: list[tuple[str, dict[str, Any]]] = []
    issues: list[GisImportIssue] = []
    for index, feature in enumerate(features, start=1):
        row = f"feature:{index}"
        if not isinstance(feature, dict):
            issues.append(GisImportIssue(row=row, field="feature", message="Feature must be an object"))
            continue
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") != "Point":
            issues.append(GisImportIssue(row=row, field="geometry", message="Only Point geometry is supported"))
            continue
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            issues.append(GisImportIssue(row=row, field="coordinates", message="Point requires [longitude, latitude]"))
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            issues.append(GisImportIssue(row=row, field="properties", message="properties must be an object"))
            continue
        record = dict(properties)
        record["longitude"] = coordinates[0]
        record["latitude"] = coordinates[1]
        records.append((row, record))
    if issues:
        raise GisImportValidationError(issues)
    return records


def _asset_from_record(record: dict[str, Any], row: str) -> InfrastructureAsset:
    issues: list[GisImportIssue] = []

    external_id = _required_text(record, "external_id", row, issues, 120)
    name = _required_text(record, "name", row, issues, 240)
    district = _required_text(record, "district", row, issues, 180)
    asset_type = _enum_value(record, "asset_type", AssetType, row, issues)
    state = _enum_value(record, "state", AssetState, row, issues, default=AssetState.NORMAL)
    latitude = _number(record, "latitude", row, issues, -90, 90)
    longitude = _number(record, "longitude", row, issues, -180, 180)
    current_year = datetime.now(timezone.utc).year
    commissioned_year = _integer(
        record,
        "commissioned_year",
        row,
        issues,
        1800,
        current_year + 1,
    )
    criticality = _integer(record, "criticality", row, issues, 0, 100, default=50)
    properties = _extract_properties(record, row, issues)
    if issues:
        raise GisImportValidationError(issues)
    assert external_id and name and district and asset_type and state is not None
    assert latitude is not None and longitude is not None
    assert commissioned_year is not None and criticality is not None
    stable_suffix = hashlib.sha256(external_id.encode("utf-8")).hexdigest()[:12]
    return InfrastructureAsset(
        id=f"asset_gis_{stable_suffix}",
        external_id=external_id,
        name=name,
        asset_type=asset_type,
        latitude=latitude,
        longitude=longitude,
        commissioned_year=commissioned_year,
        district=district,
        state=state,
        criticality=criticality,
        properties=properties,
    )


def _required_text(
    record: dict[str, Any],
    field_name: str,
    row: str,
    issues: list[GisImportIssue],
    max_length: int,
) -> str | None:
    value = str(record.get(field_name, "")).strip()
    if not value:
        issues.append(GisImportIssue(row=row, field=field_name, message="Required field"))
        return None
    if len(value) > max_length:
        issues.append(
            GisImportIssue(row=row, field=field_name, message=f"Maximum length is {max_length}")
        )
        return None
    return value


def _number(
    record: dict[str, Any],
    field_name: str,
    row: str,
    issues: list[GisImportIssue],
    minimum: float,
    maximum: float,
) -> float | None:
    try:
        value = float(record.get(field_name, ""))
    except (TypeError, ValueError):
        issues.append(GisImportIssue(row=row, field=field_name, message="Must be a number"))
        return None
    if not minimum <= value <= maximum:
        issues.append(
            GisImportIssue(
                row=row,
                field=field_name,
                message=f"Must be between {minimum} and {maximum}",
            )
        )
        return None
    return value


def _integer(
    record: dict[str, Any],
    field_name: str,
    row: str,
    issues: list[GisImportIssue],
    minimum: int,
    maximum: int,
    default: int | None = None,
) -> int | None:
    raw = record.get(field_name, default)
    if raw in {None, ""}:
        issues.append(GisImportIssue(row=row, field=field_name, message="Required field"))
        return None
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        issues.append(GisImportIssue(row=row, field=field_name, message="Must be an integer"))
        return None
    if not minimum <= value <= maximum:
        issues.append(
            GisImportIssue(
                row=row,
                field=field_name,
                message=f"Must be between {minimum} and {maximum}",
            )
        )
        return None
    return value


def _enum_value(
    record: dict[str, Any],
    field_name: str,
    enum_type,
    row: str,
    issues: list[GisImportIssue],
    default=None,
):
    raw = record.get(field_name, default.value if default is not None else "")
    try:
        return enum_type(str(raw).strip().lower())
    except ValueError:
        allowed = ", ".join(item.value for item in enum_type)
        issues.append(
            GisImportIssue(row=row, field=field_name, message=f"Allowed values: {allowed}")
        )
        return None


def _extract_properties(
    record: dict[str, Any], row: str, issues: list[GisImportIssue]
) -> dict[str, Any]:
    nested = record.get("properties", {})
    if isinstance(nested, str) and nested.strip():
        try:
            nested = json.loads(nested)
        except json.JSONDecodeError:
            issues.append(
                GisImportIssue(row=row, field="properties", message="Must be a JSON object")
            )
            return {}
    if nested is None or nested == "":
        nested = {}
    if not isinstance(nested, dict):
        issues.append(GisImportIssue(row=row, field="properties", message="Must be an object"))
        return {}
    result = dict(nested)
    for key, value in record.items():
        if key.startswith("property.") and value not in {None, ""}:
            result[key.removeprefix("property.")] = value
        elif key not in RESERVED_FIELDS and value not in {None, ""}:
            result[key] = value
    return result
