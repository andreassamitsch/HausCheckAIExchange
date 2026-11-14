"""Queue state in native Home Assistant sensor attributes."""
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([QueueSensor(hass.data[DOMAIN][entry.entry_id], entry)])


class QueueSensor(CoordinatorEntity, SensorEntity):
    _attr_name = "Warteschlange"
    _attr_icon = "mdi:playlist-music"
    _attr_native_unit_of_measurement = "Titel"
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_queue"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="YouTube Music Live", manufacturer="Home Assistant DIY",
            model="YouTube Music Live API"
        )

    @property
    def native_value(self):
        return int((self.coordinator.data or {}).get("queue_length", 0))

    @property
    def extra_state_attributes(self):
        d = self.coordinator.data or {}
        # Keep attributes below Home Assistant's state size limits.
        items = d.get("queue") or []
        return {
            "queue": [
                {"title": t.get("title"), "artist": t.get("artist"),
                 "video_id": t.get("video_id"), "duration_seconds": t.get("duration_seconds")}
                for t in items[:40] if isinstance(t, dict)
            ],
            "radio_enabled": d.get("radio_enabled", False),
            "current": d.get("current"),
            "queue_truncated": len(items) > 40,
        }
