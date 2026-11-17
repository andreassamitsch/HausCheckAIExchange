# YouTube Music Live

Home Assistant integration for the existing YouTube Music Live app (port 8765). Provides a media player, queue sensor, radio switch and service actions. The external app remains responsible for streaming and the Samsung Soundbar volume.

Configure after installation under Settings → Devices & Services. Enter the LAN URL of the app and the API key from the private app options. Never put your key in GitHub.


## Native media card with smart popup (2026-11-17)

The Family Dashboard media view uses the native Home Assistant Media Control card
through a **minimal wrapper**, `custom_components/youtube_music_live/smart-media-control-card.js`.
The actual browser resource is copied to Home Assistant's
`/config/www/ytmusic-native-media-popup-v3.js` and registered as a Lovelace
JavaScript module at `/local/ytmusic-native-media-popup-v3.js`.
The dashboard card type is `custom:smart-youtube-music-media-control-card`.

Only the media button dialog changes:
- Queue length > 0: navigate directly to the `queue` folder.
- Queue length = 0: navigate directly to the `search` folder, exposing the native search field.
- After choosing a song, action `pick` invokes the original native
  `media_player.play_media` callback and **closes the dialog**.
  The default native action `play` intentionally leaves it open.

All visual media controls are still provided by Home Assistant itself. This
wrapper sends no audio/volume commands and does not automatically start playback.
The Toniebox uses its unmodified native `media-control` card.

For a future update, deploy the JS file to `www/`, point the resource to the
new versioned path, then refresh the dashboard browser; no integration restart
is required for this frontend-only change.
