from __future__ import annotations

import unittest

try:
    from fastapi.testclient import TestClient

    from app.main import app

    HAS_FASTAPI = True
except ModuleNotFoundError:
    HAS_FASTAPI = False


@unittest.skipUnless(HAS_FASTAPI, "FastAPI dependencies are not installed locally")
class ApiSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_and_demo(self) -> None:
        health = self.client.get("/api/v1/health")
        self.assertEqual(health.status_code, 200)
        self.assertTrue(health.json()["deterministic_core"])
        self.assertEqual(
            health.json()["integrations"]["gis_import"]["formats"],
            ["csv", "geojson"],
        )

        response = self.client.post("/api/v1/demo/water-leak")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kpis"]["confirmed_incidents"], 1)
        recommendation = payload["incidents"][0]["recommendations"][0]
        self.assertTrue(recommendation["requires_human_approval"])
        self.assertTrue(recommendation["source"])

    def test_gis_import_defaults_to_dry_run_then_applies(self) -> None:
        csv_content = (
            "external_id,name,asset_type,latitude,longitude,commissioned_year,"
            "district,criticality,state\n"
            "WM-AST-777,Пилотный участок,water_main,51.128,71.431,2019,Алматы,75,normal\n"
        )
        preview = self.client.post(
            "/api/v1/integrations/gis/import",
            files={"file": ("assets.csv", csv_content, "text/csv")},
        )
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.json()["valid"])
        self.assertTrue(preview.json()["dry_run"])
        self.assertFalse(preview.json()["applied"])

        applied = self.client.post(
            "/api/v1/integrations/gis/import",
            files={"file": ("assets.csv", csv_content, "text/csv")},
            data={"dry_run": "false"},
        )
        self.assertEqual(applied.status_code, 200)
        self.assertTrue(applied.json()["applied"])
        self.assertEqual(applied.json()["created"], 1)

    def test_invalid_gis_import_returns_issues(self) -> None:
        invalid = (
            "external_id,name,asset_type,latitude,longitude,commissioned_year,district\n"
            "WM-BAD,Ошибка,water_main,999,71.431,2019,Алматы\n"
        )
        response = self.client.post(
            "/api/v1/integrations/gis/import",
            files={"file": ("assets.csv", invalid, "text/csv")},
            data={"dry_run": "false"},
        )
        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertIn("no changes", detail["message"])
        self.assertTrue(any(issue["field"] == "latitude" for issue in detail["issues"]))


if __name__ == "__main__":
    unittest.main()
