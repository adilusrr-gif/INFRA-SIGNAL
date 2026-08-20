from __future__ import annotations

import json
import unittest

from app.services.gis_import import GisImportValidationError, import_gis_assets
from app.services.store import InMemoryStore


CSV_HEADER = (
    "external_id,name,asset_type,latitude,longitude,commissioned_year,"
    "district,criticality,state,property.diameter_mm\n"
)


class GisImportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()

    def test_csv_dry_run_apply_and_idempotent_replay(self) -> None:
        content = (
            CSV_HEADER
            + "WM-AST-042,Магистраль №42,water_main,51.128,71.431,1987,Алматы,86,normal,500\n"
            + "ES-AST-009,Подстанция №9,electric_substation,51.141,71.420,2011,Сарыарқа,82,normal,\n"
        ).encode()

        preview = import_gis_assets(
            content=content,
            filename="assets.csv",
            content_type="text/csv",
            store=self.store,
            dry_run=True,
        )
        self.assertEqual(preview.created, 2)
        self.assertFalse(preview.applied)
        self.assertEqual(self.store.list_assets(), [])

        applied = import_gis_assets(
            content=content,
            filename="assets.csv",
            content_type="text/csv",
            store=self.store,
            dry_run=False,
        )
        self.assertEqual(applied.created, 2)
        self.assertTrue(applied.applied)
        self.assertEqual(len(self.store.list_assets()), 2)
        self.assertEqual(self.store.list_assets()[0].properties["diameter_mm"], "500")

        replay = import_gis_assets(
            content=content,
            filename="assets.csv",
            content_type="text/csv",
            store=self.store,
            dry_run=False,
        )
        self.assertEqual(replay.unchanged, 2)
        self.assertEqual(replay.created, 0)
        self.assertEqual(len(self.store.list_assets()), 2)

    def test_existing_asset_is_updated_without_changing_internal_id(self) -> None:
        first = (
            CSV_HEADER
            + "WM-AST-042,Старое имя,water_main,51.128,71.431,1987,Алматы,86,normal,500\n"
        ).encode()
        second = (
            CSV_HEADER
            + "WM-AST-042,Новое имя,water_main,51.128,71.431,1987,Алматы,91,degraded,500\n"
        ).encode()
        import_gis_assets(
            content=first,
            filename="assets.csv",
            content_type="text/csv",
            store=self.store,
            dry_run=False,
        )
        original_id = self.store.list_assets()[0].id
        result = import_gis_assets(
            content=second,
            filename="assets.csv",
            content_type="text/csv",
            store=self.store,
            dry_run=False,
        )
        asset = self.store.list_assets()[0]
        self.assertEqual(result.updated, 1)
        self.assertEqual(asset.id, original_id)
        self.assertEqual(asset.name, "Новое имя")
        self.assertEqual(asset.criticality, 91)
        self.assertEqual(asset.state.value, "degraded")

    def test_geojson_point_import(self) -> None:
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [71.431, 51.128]},
                    "properties": {
                        "external_id": "WM-AST-042",
                        "name": "Магистраль №42",
                        "asset_type": "water_main",
                        "commissioned_year": 1987,
                        "district": "Алматы",
                        "criticality": 86,
                        "diameter_mm": 500,
                    },
                }
            ],
        }
        result = import_gis_assets(
            content=json.dumps(payload, ensure_ascii=False).encode(),
            filename="assets.geojson",
            content_type="application/geo+json",
            store=self.store,
            dry_run=False,
        )
        self.assertEqual(result.created, 1)
        asset = self.store.list_assets()[0]
        self.assertEqual(asset.longitude, 71.431)
        self.assertEqual(asset.latitude, 51.128)
        self.assertEqual(asset.properties["diameter_mm"], 500)

    def test_invalid_file_is_atomic(self) -> None:
        content = (
            CSV_HEADER
            + "WM-AST-042,Магистраль №42,water_main,51.128,71.431,1987,Алматы,86,normal,500\n"
            + "WM-BAD-001,Ошибка,water_main,999,71.431,1987,Алматы,86,normal,500\n"
        ).encode()
        with self.assertRaises(GisImportValidationError) as raised:
            import_gis_assets(
                content=content,
                filename="assets.csv",
                content_type="text/csv",
                store=self.store,
                dry_run=False,
            )
        self.assertTrue(any(issue.field == "latitude" for issue in raised.exception.issues))
        self.assertEqual(self.store.list_assets(), [])

    def test_duplicate_external_id_is_rejected(self) -> None:
        row = "WM-AST-042,Магистраль №42,water_main,51.128,71.431,1987,Алматы,86,normal,500\n"
        with self.assertRaises(GisImportValidationError) as raised:
            import_gis_assets(
                content=(CSV_HEADER + row + row).encode(),
                filename="assets.csv",
                content_type="text/csv",
                store=self.store,
                dry_run=True,
            )
        self.assertTrue(
            any("Duplicate external_id" in issue.message for issue in raised.exception.issues)
        )


if __name__ == "__main__":
    unittest.main()
