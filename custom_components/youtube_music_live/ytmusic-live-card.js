/* YouTube Music Live - native Home Assistant dashboard card (no external dependencies). */
class YoutubeMusicLiveCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
    this._query = "";
    this._signature = "";
  }
  setConfig(config) {
    if (!config.media_entity || !config.queue_entity || !config.radio_entity) {
      throw new Error("media_entity, queue_entity und radio_entity sind erforderlich");
    }
    this._config = config;
    this._signature = "";
    this._draw();
  }
  static getStubConfig() {
    return {type:"custom:ytmusic-live-card",
      media_entity:"media_player.youtube_music_live",
      queue_entity:"sensor.youtube_music_live_warteschlange",
      radio_entity:"switch.youtube_music_live_automatische_folgetitel"};
  }
  getCardSize() { return 8; }
  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    if (!c) return;
    const player = hass.states[c.media_entity], queue = hass.states[c.queue_entity],
          radio = hass.states[c.radio_entity];
    const sig = JSON.stringify([
      player?.state, player?.attributes?.media_title, player?.attributes?.media_artist,
      queue?.state, queue?.attributes?.queue, radio?.state
    ]);
    if (this._signature !== sig) {
      this._signature = sig;
      this._draw();
    }
  }
  _node(tag, className, content) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = String(content);
    return n;
  }
  _btn(label, title, action, disabled=false) {
    const n=this._node("button","action",label);
    n.title=title;
    n.disabled=disabled;
    n.addEventListener("click",async()=>{
      n.disabled=true;
      try { await action(); }
      catch(e) { this._error(e); }
      finally { n.disabled=false; }
    });
    return n;
  }
  _error(e) {
    const msg=e?.message||String(e);
    if (this._hass?.showToast) this._hass.showToast({message:msg});
    else { const status=this.shadowRoot.querySelector(".status"); if(status) status.textContent=msg; }
  }
  _call(domain,service,data={}) {
    return this._hass.callService(domain,service,data);
  }
  _draw() {
    const h=this._hass, c=this._config;
    if(!h||!c) return;
    const player=h.states[c.media_entity], queueState=h.states[c.queue_entity],
          radio=h.states[c.radio_entity];
    const tracks=Array.isArray(queueState?.attributes?.queue)?queueState.attributes.queue:[];
    const playing=player?.state==="playing";
    const track=player?.attributes||{};
    const root=this.shadowRoot;
    root.replaceChildren();
    const style=document.createElement("style");
    style.textContent=`
      :host{display:block}ha-card{padding:16px;border-radius:16px;overflow:hidden}
      h2{font-size:19px;font-weight:650;margin:0 0 10px}
      .now{font-size:18px;font-weight:600;overflow-wrap:anywhere}
      .artist,.sub,.status{font-size:13px;color:var(--secondary-text-color)}
      .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
      .action{border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color,transparent);
        color:var(--primary-text-color);padding:9px 12px;font:inherit;cursor:pointer;touch-action:manipulation;min-height:40px}
      .action:disabled{opacity:.35;cursor:default}
      .action:hover:not(:disabled){background:var(--primary-color);color:var(--text-primary-color,#fff)}
      .search{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      input{flex:1;min-width:140px;min-height:40px;box-sizing:border-box;background:var(--card-background-color);
        color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:10px;padding:8px;font-size:16px}
      .queue-title{display:flex;justify-content:space-between;align-items:center;margin:16px 0 6px}
      .queue-title strong{font-size:16px}
      .items{max-height:500px;overflow:auto}
      .item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--divider-color)}
      .num{color:var(--secondary-text-color);min-width:24px;font-size:13px}
      .track{flex:1;min-width:0}
      .track-title{font-size:14px;overflow-wrap:anywhere}
      .mini{display:flex;gap:3px}
      .mini button{padding:4px 7px;min-height:32px}
      .on{color:var(--success-color,#42a865)}
      @media(max-width:480px){ha-card{padding:12px}.item{gap:4px}.mini button{padding:3px 5px}}
    `;
    root.appendChild(style);
    const card=this._node("ha-card");
    const title=this._node("h2",null,"YouTube Music Live");
    card.appendChild(title);
    const now=this._node("div","now",track.media_title||"Keine Wiedergabe");
    const artist=this._node("div","artist",track.media_artist||"Ultra Slim Soundbar");
    card.append(now,artist);
    const bar=this._node("div","toolbar");
    bar.append(
      this._btn(playing?"⏸ Pause":"▶ Weiter",playing?"Pausieren":"Fortsetzen",
        ()=>this._call("media_player",playing?"media_pause":"media_play",{entity_id:c.media_entity})),
      this._btn("⏭ Nächstes","Nächster Titel",()=>this._call("media_player","media_next_track",{entity_id:c.media_entity})),
      this._btn("⏹ Stopp","Anhalten",()=>this._call("media_player","media_stop",{entity_id:c.media_entity})),
      this._btn(radio?.state==="on"?"◉ Radio an":"○ Radio aus","Radio ein- oder ausschalten",
        ()=>this._call("switch",radio?.state==="on"?"turn_off":"turn_on",{entity_id:c.radio_entity}))
    );
    card.appendChild(bar);
    const search=this._node("div","search");
    const input=this._node("input");
    input.type="search"; input.placeholder="Künstler oder Song suchen";input.value=this._query;
    input.addEventListener("input",()=>{this._query=input.value;});
    input.addEventListener("keydown",e=>{if(e.key==="Enter")start.click();});
    const start=this._btn("▶ Starten","Suche abspielen",()=>this._start("play_query"));
    const add=this._btn("+ Merken","Zur Warteschlange hinzufügen",()=>this._start("enqueue"));
    search.append(input,start,add);
    card.appendChild(search);
    const qh=this._node("div","queue-title");
    qh.append(this._node("strong",null,"Warteschlange"),
      this._node("span","sub",(queueState?.state||"0")+" Titel"));
    card.appendChild(qh);
    const items=this._node("div","items");
    tracks.forEach((t,i)=>{
      const row=this._node("div","item");
      const num=this._node("div","num",i+1);
      const label=this._node("div","track");
      label.append(this._node("div","track-title",t.title||"Unbenannter Titel"),
        this._node("div","sub",t.artist||""));
      const mini=this._node("div","mini");
      mini.append(
        this._btn("↑","Nach oben",()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i-1}),i===0),
        this._btn("↓","Nach unten",()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i+1}),i>=tracks.length-1),
        this._btn("×","Entfernen",()=>this._call("youtube_music_live","queue_remove",{index:i}))
      );
      row.append(num,label,mini);
      items.appendChild(row);
    });
    if (!tracks.length) items.appendChild(this._node("div","sub","Keine Folgetitel vorgemerkt"));
    card.appendChild(items);
    if (tracks.length) {
      const foot=this._node("div","toolbar");
      foot.append(this._btn("Warteschlange leeren","Nur kommende Titel entfernen",
        ()=>this._call("youtube_music_live","queue_clear")));
      card.appendChild(foot);
    }
    card.appendChild(this._node("div","status",
      queueState?.attributes?.queue_truncated?"Es werden nur die ersten 40 Titel angezeigt.":""));
    root.appendChild(card);
  }
  async _start(service) {
    const query=this._query.trim();
    if (!query) return;
    await this._call("youtube_music_live",service,{query,...(service==="play_query"?{radio:true}:{})});
    this._query="";
    const input=this.shadowRoot.querySelector("input");
    if(input)input.value="";
  }
}
customElements.define("ytmusic-live-card",YoutubeMusicLiveCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"ytmusic-live-card",name:"YouTube Music Live",description:"Wiedergabe, Radio und Warteschlange"});
