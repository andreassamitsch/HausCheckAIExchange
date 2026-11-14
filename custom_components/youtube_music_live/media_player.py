"""Player entity for YouTube Music Live, separate from the actual Cast soundbar."""
from __future__ import annotations

from homeassistant.components.media_player import (
    MediaPlayerEntity, MediaPlayerEntityFeature, MediaPlayerState
)
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([MusicPlayer(hass.data[DOMAIN][entry.entry_id], entry)])


class MusicPlayer(CoordinatorEntity, MediaPlayerEntity):
    _attr_name = "YouTube Music Live"
    _attr_icon = "mdi:music-circle"
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PLAY_MEDIA
    )

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_player"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="YouTube Music Live", manufacturer="Home Assistant DIY",
            model="YouTube Music Live API"
        )

    @property
    def state(self):
        data = self.coordinator.data or {}
        if not data.get("current"):
            return MediaPlayerState.IDLE
        status = data.get("cast_state")
        if status == "playing":
            return MediaPlayerState.PLAYING
        if status == "paused":
            return MediaPlayerState.PAUSED
        if status == "starting":
            return MediaPlayerState.BUFFERING
        return MediaPlayerState.IDLE

    @property
    def media_title(self):
        return (self.coordinator.data or {}).get("current", {}).get("title") if (self.coordinator.data or {}).get("current") else None

    @property
    def media_artist(self):
        return (self.coordinator.data or {}).get("current", {}).get("artist") if (self.coordinator.data or {}).get("current") else None

    @property
    def media_duration(self):
        return (self.coordinator.data or {}).get("current", {}).get("duration_seconds") if (self.coordinator.data or {}).get("current") else None

    @property
    def extra_state_attributes(self):
        d = self.coordinator.data or {}
        return {
            "queue_length": d.get("queue_length", 0),
            "radio_enabled": d.get("radio_enabled", False),
            "soundbar_entity_id": d.get("player_entity"),
            "last_error": d.get("last_error"),
        }

    async def async_media_play(self):
        await self.coordinator.command("/api/resume")

    async def async_media_pause(self):
        await self.coordinator.command("/api/pause")

    async def async_media_stop(self):
        await self.coordinator.command("/api/stop")

    async def async_media_next_track(self):
        await self.coordinator.command("/api/next")

    async def async_play_media(self, media_type, media_id, **kwargs):
        if media_type == "playlist":
            await self.coordinator.command("/api/playlist", {
                "playlist_id": str(media_id), "radio_after": True
            })
        elif str(media_id).startswith("id:"):
            await self.coordinator.command("/api/play", {
                "video_id": str(media_id)[3:], "radio": True
            })
        else:
            await self.coordinator.command("/api/play", {
                "query": str(media_id), "radio": True
            })
