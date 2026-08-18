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

        response = self.client.post("/api/v1/demo/water-leak")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kpis"]["confirmed_incidents"], 1)
        recommendation = payload["incidents"][0]["recommendations"][0]
        self.assertTrue(recommendation["requires_human_approval"])
        self.assertTrue(recommendation["source"])


if __name__ == "__main__":
    unittest.main()
