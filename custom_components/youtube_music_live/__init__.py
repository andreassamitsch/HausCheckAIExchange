"""Home Assistant bridge for the existing YouTube Music Live app.

The app is the single source of truth for playback and queue; the integration
does not take over Cast or set the Soundbar's volume.
"""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path
import logging

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.exceptions import HomeAssistantError

from .api import MusicAPIError, MusicClient
from .const import CONF_API_KEY, CONF_URL, DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)


class MusicCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, client: MusicClient):
        super().__init__(hass, _LOGGER, name=DOMAIN, update_interval=timedelta(seconds=4))
        self.client = client

    async def _async_update_data(self):
        try:
            return await self.client.status()
        except MusicAPIError as exc:
            raise UpdateFailed(str(exc)) from exc

    async def command(self, path: str, payload: dict | None = None):
        try:
            result = await self.client.post(path, payload)
        except MusicAPIError as exc:
            raise HomeAssistantError(str(exc)) from exc
        await self.async_request_refresh()
        return result


def _register_services(hass: HomeAssistant) -> None:
    async def run(call: ServiceCall) -> None:
        entries = hass.data.get(DOMAIN, {})
        if not entries:
            raise HomeAssistantError("YouTube Music Live is not configured")
        coordinator = next(iter(entries.values()))
        operation = call.service
        d = call.data
        if operation == "play_query":
            await coordinator.command("/api/play", {"query": d["query"], "radio": d.get("radio", True)})
        elif operation == "enqueue":
            await coordinator.command("/api/queue", {"query": d["query"]})
        elif operation == "play_video":
            await coordinator.command("/api/play", {"video_id": d["video_id"], "radio": d.get("radio", True)})
        elif operation == "play_playlist":
            await coordinator.command("/api/playlist", {"playlist_id": d["playlist_id"], "shuffle": d.get("shuffle", False), "radio_after": d.get("radio_after", True)})
        elif operation == "queue_remove":
            await coordinator.command("/api/queue/remove", {"index": d["index"]})
        elif operation == "queue_move":
            await coordinator.command("/api/queue/move", {"from_index": d["from_index"], "to_index": d["to_index"]})
        elif operation == "queue_clear":
            await coordinator.command("/api/queue/clear")

    service_schemas = {
        "play_query": vol.Schema({vol.Required("query"): vol.All(str, vol.Length(min=1)), vol.Optional("radio", default=True): bool}),
        "enqueue": vol.Schema({vol.Required("query"): vol.All(str, vol.Length(min=1))}),
        "play_video": vol.Schema({vol.Required("video_id"): vol.Match(r"^[A-Za-z0-9_-]{11}$"), vol.Optional("radio", default=True): bool}),
        "play_playlist": vol.Schema({vol.Required("playlist_id"): str, vol.Optional("shuffle", default=False): bool, vol.Optional("radio_after", default=True): bool}),
        "queue_remove": vol.Schema({vol.Required("index"): vol.All(vol.Coerce(int), vol.Range(min=0))}),
        "queue_move": vol.Schema({vol.Required("from_index"): vol.All(vol.Coerce(int), vol.Range(min=0)), vol.Required("to_index"): vol.All(vol.Coerce(int), vol.Range(min=0))}),
        "queue_clear": vol.Schema({}),
    }
    for name, schema in service_schemas.items():
        hass.services.async_register(DOMAIN, name, run, schema=schema)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    client = MusicClient(hass, entry.data[CONF_URL], entry.data[CONF_API_KEY])
    coordinator = MusicCoordinator(hass, client)
    await coordinator.async_config_entry_first_refresh()
    if DOMAIN not in hass.data or not hass.data[DOMAIN]:
        await hass.http.async_register_static_paths([
            StaticPathConfig(
                "/youtube_music_live/ytmusic-live-card.js",
                str(Path(__file__).parent / "ytmusic-live-card.js"),
                False
            )
        ])
        _register_services(hass)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    success = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if success:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            for service in ("play_query", "enqueue", "play_video", "play_playlist",
                            "queue_remove", "queue_move", "queue_clear"):
                hass.services.async_remove(DOMAIN, service)
    return success
