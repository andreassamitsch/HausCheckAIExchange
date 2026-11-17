/* Minimal wrapper around Home Assistant's native media-control card.
 * Keeps the stock artwork, transport, seek, volume and responsive styling.
 * Only changes where the Media icon opens and closes after selection.
 */
class SmartYouTubeMusicMediaControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:"open"});
    this._card=document.createElement("hui-media-control-card");
    this.shadowRoot.appendChild(this._card);
    this._card.addEventListener("show-dialog", e=>this._prepareBrowseDialog(e));
  }

  static getStubConfig(){
    return {
      type:"custom:smart-youtube-music-media-control-card",
      entity:"media_player.youtube_music_live_youtube_music_live",
      name:"Ultra Slim Soundbar"
    };
  }

  setConfig(config){
    if(!config.entity || !config.entity.startsWith("media_player.")){
      throw new Error("Ein media_player ist erforderlich");
    }
    this._config={...config};
    this._card.setConfig({type:"media-control",entity:config.entity,...(config.name?{name:config.name}:{})});
  }

  set hass(hass){
    this._hass=hass;
    // The native card uses HA contexts. Forward state as well for compatibility.
    this._card.hass=hass;
  }

  getCardSize(){return this._card.getCardSize?.()||3;}
  getLayoutOptions(){return this._card.getLayoutOptions?.()||{grid_columns:12,grid_rows:"auto"};}

  _prepareBrowseDialog(event){
    const details=event.detail;
    const params=details?.dialogParams;
    if(details?.dialogTag!=="dialog-media-player-browse" ||
       params?.entityId!==this._config?.entity)return;

    const state=this._hass?.states?.[this._config.entity];
    const count=Number(state?.attributes?.queue_length||0);
    const destination=count>0?"queue":"search";

    // The browser only shows its search input below the root level. Beginning
    // at a real subdirectory both skips the empty landing page and preserves
    // the back arrow to search/history when browsing the queue.
    params.navigateIds=[
      {media_content_id:undefined,media_content_type:undefined},
      {media_content_id:destination,media_content_type:"music"}
    ];

    // Native HA action 'play' intentionally leaves the dialog open.
    // Action 'select' calls the same mediaPickedCallback (play_media), but
    // the standard dialog then automatically closes after a song is picked.
    // No soundbar commands are issued here: the existing callback owns playback.
    params.action="select";
  }
}
if(!customElements.get("smart-youtube-music-media-control-card")){
  customElements.define("smart-youtube-music-media-control-card",SmartYouTubeMusicMediaControlCard);
}
window.customCards=window.customCards||[];
if(!window.customCards.some(item=>item.type==="smart-youtube-music-media-control-card")){
  window.customCards.push({
    type:"smart-youtube-music-media-control-card",
    name:"YouTube Music – native Medienkarte",
    description:"Original Media Control, mit Warteschlange/Suche und Auto-Schließen im Medienpopup."
  });
}
