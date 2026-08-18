from __future__ import annotations

import unittest

from app.core.config import Settings
from app.services.callcenter_adapter import CallcenterVoiceAdapter
from app.services.kence_adapter import KenceGuidanceAdapter


class IntegrationBoundaryTests(unittest.TestCase):
    def test_adapters_are_off_by_default(self) -> None:
        settings = Settings(enable_ollama=False)
        self.assertFalse(CallcenterVoiceAdapter(settings).configured)
        self.assertFalse(KenceGuidanceAdapter(settings).configured)

    def test_kence_requires_url_token_and_session(self) -> None:
        incomplete = Settings(
            enable_ollama=False,
            kence_base_url="http://kence:8000",
            kence_api_token="token",
        )
        complete = Settings(
            enable_ollama=False,
            kence_base_url="http://kence:8000",
            kence_api_token="token",
            kence_session_id="session-42",
        )
        self.assertFalse(KenceGuidanceAdapter(incomplete).configured)
        self.assertTrue(KenceGuidanceAdapter(complete).configured)


if __name__ == "__main__":
    unittest.main()
