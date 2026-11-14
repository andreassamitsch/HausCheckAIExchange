"""Toggle automatic YouTube Music Radio suggestions."""
from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([RadioSwitch(hass.data[DOMAIN][entry.entry_id], entry)])


class RadioSwitch(CoordinatorEntity, SwitchEntity):
    _attr_name = "Automatische Folgetitel"
    _attr_icon = "mdi:radio"
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_radio"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="YouTube Music Live", manufacturer="Home Assistant DIY",
            model="YouTube Music Live API"
        )

    @property
    def is_on(self):
        return bool((self.coordinator.data or {}).get("radio_enabled", False))

    async def async_turn_on(self, **kwargs):
        await self.coordinator.command("/api/radio", {"enabled": True})

    async def async_turn_off(self, **kwargs):
        await self.coordinator.command("/api/radio", {"enabled": False})
