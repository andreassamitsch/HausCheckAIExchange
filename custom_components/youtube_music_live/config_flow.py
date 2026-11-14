"""UI configuration of the local YouTube Music Live server."""
from __future__ import annotations
from urllib.parse import urlsplit

import voluptuous as vol
from homeassistant import config_entries

from .api import MusicAuthError, MusicAPIError, MusicClient
from .const import CONF_API_KEY, CONF_URL, DEFAULT_URL, DOMAIN


class YoutubeMusicLiveConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            url = user_input[CONF_URL].strip().rstrip("/")
            parsed = urlsplit(url)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                errors["base"] = "invalid_url"
            else:
                try:
                    client = MusicClient(self.hass, url, user_input[CONF_API_KEY])
                    await client.status()
                except MusicAuthError:
                    errors["base"] = "invalid_auth"
                except (MusicAPIError, ValueError):
                    errors["base"] = "cannot_connect"
                else:
                    await self.async_set_unique_id(url.lower())
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(
                        title="YouTube Music Live",
                        data={CONF_URL: url, CONF_API_KEY: user_input[CONF_API_KEY]}
                    )
        schema = vol.Schema({
            vol.Required(CONF_URL, default=(user_input or {}).get(CONF_URL, DEFAULT_URL)): str,
            vol.Required(CONF_API_KEY): str
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
