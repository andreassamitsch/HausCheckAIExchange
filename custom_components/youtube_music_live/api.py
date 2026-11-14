"""Small async client for the self-hosted YouTube Music Live app."""
from __future__ import annotations

from urllib.parse import urlsplit

import aiohttp
from homeassistant.helpers.aiohttp_client import async_get_clientsession


class MusicAPIError(Exception):
    """API request failed."""


class MusicAuthError(MusicAPIError):
    """Authentication refused."""


class MusicClient:
    def __init__(self, hass, url: str, api_key: str) -> None:
        self._session = async_get_clientsession(hass)
        parsed = urlsplit(url.strip().rstrip("/"))
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Enter an http(s) URL without credentials")
        self.url = url.strip().rstrip("/")
        self._headers = {"X-API-Key": api_key}

    async def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        try:
            async with self._session.request(
                method, self.url + path, headers=self._headers, json=payload,
                timeout=aiohttp.ClientTimeout(total=45 if method == "POST" else 12)
            ) as response:
                if response.status in (401, 403):
                    raise MusicAuthError("The app rejected the API key")
                if response.status >= 400:
                    raise MusicAPIError(f"App returned HTTP {response.status}")
                data = await response.json(content_type=None)
                if not isinstance(data, dict) or data.get("error"):
                    raise MusicAPIError("Invalid app response")
                return data
        except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
            raise MusicAPIError("Cannot reach YouTube Music Live") from exc

    async def status(self) -> dict:
        return await self.request("GET", "/api/status")

    async def post(self, path: str, data: dict | None = None) -> dict:
        return await self.request("POST", path, data or {})
