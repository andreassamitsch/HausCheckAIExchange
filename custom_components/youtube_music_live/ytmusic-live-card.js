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
if(!customElements.get("ytmusic-live-card"))customElements.define("ytmusic-live-card",YoutubeMusicLiveCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"ytmusic-live-card",name:"YouTube Music Live",description:"Wiedergabe, Radio und Warteschlange"});


class UltraSlimMusicCard extends YoutubeMusicLiveCard {
  constructor(){ super(); this._expanded=false; }
  static getStubConfig(){
    return {type:"custom:ultra-slim-music-card",
      media_entity:"media_player.youtube_music_live_youtube_music_live",
      queue_entity:"sensor.youtube_music_live_warteschlange",
      radio_entity:"switch.youtube_music_live_automatische_folgetitel",
      soundbar_entity:"media_player.ultra_slim_soundbar",
      power_entity:"media_player.ultra_slim_soundbar_2"};
  }
  getCardSize(){return this._expanded?8:4;}
  set hass(h){
    this._hass=h;
    const c=this._config;if(!c)return;
    const sig=JSON.stringify([c.media_entity,c.queue_entity,c.radio_entity,c.soundbar_entity,c.power_entity].map((id,i)=>{
      const s=h.states[id];if(!s)return null;
      if(i===0)return [s.state,s.attributes.media_title,s.attributes.media_artist];
      if(i===1)return [s.state,s.attributes.queue];
      if(i===2)return s.state;
      return [s.state,s.attributes.volume_level,s.attributes.is_volume_muted];
    }));
    if(sig!==this._signature){
      if(this.shadowRoot.activeElement?.type==="search")return;
      this._signature=sig;this._draw();
    }
  }
  _icon(name,size="23px"){
    const node=this._node("ha-icon");node.setAttribute("icon",name);
    node.style.setProperty("--mdc-icon-size",size);node.style.width=size;node.style.height=size;return node;
  }
  _iconBtn(name,title,action,disabled=false){
    const node=this._node("button","icon-btn");node.type="button";node.title=title;
    node.setAttribute("aria-label",title);node.disabled=disabled;node.append(this._icon(name));
    node.addEventListener("click",async()=>{
      node.disabled=true;
      try{await action()}catch(e){this._error(e)}finally{node.disabled=disabled}
    });
    return node;
  }
  _draw(){
    const c=this._config,h=this._hass;if(!c||!h)return;
    const player=h.states[c.media_entity],q=h.states[c.queue_entity],radio=h.states[c.radio_entity],
      sound=h.states[c.soundbar_entity],power=h.states[c.power_entity];
    const items=Array.isArray(q?.attributes?.queue)?q.attributes.queue:[];
    const total=Number(q?.state)||items.length;
    const playing=player?.state==="playing";
    const hasTrack=playing||player?.state==="paused"||player?.state==="buffering";
    const volume=Math.round(100*(sound?.attributes?.volume_level??power?.attributes?.volume_level??0));
    const muted=!!sound?.attributes?.is_volume_muted;
    const root=this.shadowRoot;root.replaceChildren();
    const style=this._node("style");style.textContent="\n:host{display:block;min-width:0}\nha-card{box-sizing:border-box;border-radius:18px;overflow:hidden;padding:15px;\nbackground:linear-gradient(120deg,#049dc5,#008fc0);color:white;box-shadow:none;border:1px solid rgba(0,0,0,.06)}\n.head{display:flex;gap:10px;align-items:center}\n.head b{font-size:19px;font-weight:550;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.icon-btn{border:0;border-radius:12px;background:transparent;color:inherit;min-width:43px;height:44px;display:grid;place-items:center;padding:5px;cursor:pointer;touch-action:manipulation}\n.icon-btn:hover{background:rgba(255,255,255,.16)}.icon-btn:disabled{opacity:.3}\n.info{display:flex;gap:12px;align-items:center;min-height:72px;margin:10px 0 0}\n.txt{flex:1;min-width:0}\n.title{font-size:18px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.artist{font-size:13px;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}\n.art{width:65px;height:65px;border-radius:12px;background:rgba(255,255,255,.16);display:grid;place-items:center;flex:none}\n.transport{display:flex;justify-content:space-around;align-items:center;gap:5px;margin-top:7px}\n.transport .icon-btn{width:53px;height:50px}\n.transport .play{background:rgba(255,255,255,.2);border-radius:50%;height:55px;width:55px}\n.vol{display:flex;align-items:center;gap:8px;margin:6px 0 0}\n.vol input{flex:1;min-width:0;min-height:32px;accent-color:white}\n.percent{min-width:37px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums}\n.foot{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:9px;border-top:1px solid rgba(255,255,255,.25)}\n.expand{border:0;color:inherit;background:transparent;display:flex;align-items:center;gap:5px;flex:1;min-height:39px;padding:2px;cursor:pointer;text-align:left;font-size:13px}\n.radio{color:white;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.4);border-radius:9px;padding:8px;font-size:12px;cursor:pointer}\n.radio.active{background:rgba(255,255,255,.26)}\n.detail{background:var(--card-background-color);color:var(--primary-text-color);padding:13px 15px;margin:13px -15px -15px;border-radius:0 0 17px 17px}\n.search{display:flex;flex-wrap:wrap;gap:7px}\n.search input{min-width:160px;flex:1;font:inherit;font-size:16px;color:var(--primary-text-color);background:var(--card-background-color);padding:9px;border:1px solid var(--divider-color);border-radius:9px}\n.small{font:inherit;font-size:13px;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:9px;min-height:39px;padding:9px;cursor:pointer}\n.qhead{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px;margin:15px 0 6px}\n.qlist{max-height:385px;overflow-y:auto}\n.qrow{display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--divider-color);min-height:55px;padding:4px 0}\n.num{min-width:19px;color:var(--secondary-text-color);font-size:12px}\n.song{flex:1;min-width:0}\n.song-title{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.song-artist{font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.actions{display:flex;gap:2px}\n.actions .icon-btn{color:var(--primary-text-color);min-width:32px;width:32px;height:36px;padding:4px;border:1px solid var(--divider-color)}\n.actions ha-icon{--mdc-icon-size:19px!important;width:19px!important;height:19px!important}\n.feedback{color:var(--error-color);font-size:12px}\n@media(max-width:480px){ha-card{padding:12px}.head b{font-size:17px}.detail{margin:12px -12px -12px;padding:12px}.art{width:60px;height:60px}}\n";root.append(style);
    const card=this._node("ha-card");
    const head=this._node("div","head");
    head.append(this._icon("mdi:speaker","28px"),this._node("b",null,"Ultra Slim Soundbar"));
    if(power&&power.state!=="unavailable"&&power.state!=="unknown"){
      const on=power.state!=="off";
      head.append(this._iconBtn("mdi:power",on?"Soundbar ausschalten":"Soundbar einschalten",
        ()=>this._call("media_player",on?"turn_off":"turn_on",{entity_id:c.power_entity})));
    }
    card.append(head);
    const info=this._node("div","info"),txt=this._node("div","txt");
    txt.append(this._node("div","title",hasTrack?(player.attributes.media_title||"YouTube Music"):"YouTube Music"));
    txt.append(this._node("div","artist",hasTrack?(player.attributes.media_artist||"Soundbar"):"Bereit für Musik"));
    info.append(txt);
    const art=this._node("div","art");art.append(this._icon("mdi:music-box-multiple","44px"));info.append(art);
    card.append(info);
    const transport=this._node("div","transport");
    transport.append(
      this._iconBtn("mdi:stop","Stopp",()=>this._call("media_player","media_stop",{entity_id:c.media_entity})),
      this._iconBtn(playing?"mdi:pause":"mdi:play",playing?"Pause":"Fortsetzen",
        ()=>this._call("media_player",playing?"media_pause":"media_play",{entity_id:c.media_entity})),
      this._iconBtn("mdi:skip-next","Nächster Titel",
        ()=>this._call("media_player","media_next_track",{entity_id:c.media_entity})),
      this._iconBtn(muted?"mdi:volume-off":"mdi:volume-high","Stummschalten",
        ()=>this._call("media_player","volume_mute",{entity_id:c.soundbar_entity,is_volume_muted:!muted}),!sound)
    );
    transport.children[1].classList.add("play");card.append(transport);
    const vol=this._node("div","vol");vol.append(this._icon("mdi:volume-low","20px"));
    const slider=this._node("input");slider.type="range";slider.min="0";slider.max="100";slider.step="1";
    slider.value=String(volume);slider.disabled=!sound||sound.state==="unavailable";
    slider.setAttribute("aria-label","Lautstärke");
    const percent=this._node("span","percent",volume+" %");
    slider.addEventListener("input",()=>percent.textContent=slider.value+" %");
    slider.addEventListener("change",async()=>{
      try{await this._call("media_player","volume_set",{entity_id:c.soundbar_entity,volume_level:Number(slider.value)/100})}
      catch(e){this._error(e)}
    });
    vol.append(slider,percent);card.append(vol);
    const foot=this._node("div","foot"),expand=this._node("button","expand");
    expand.type="button";expand.append(this._icon(this._expanded?"mdi:chevron-up":"mdi:chevron-down","20px"),
      this._node("span",null,"Warteschlange · "+total+" Titel"));
    expand.addEventListener("click",()=>{this._expanded=!this._expanded;this._draw()});foot.append(expand);
    const radioBtn=this._node("button","radio"+(radio?.state==="on"?" active":""),
      radio?.state==="on"?"Radio an":"Radio aus");radioBtn.type="button";radioBtn.disabled=!radio;
    radioBtn.addEventListener("click",async()=>{
      try{await this._call("switch",radio.state==="on"?"turn_off":"turn_on",{entity_id:c.radio_entity})}
      catch(e){this._error(e)}
    });
    foot.append(radioBtn);card.append(foot);
    if(this._expanded){
      const detail=this._node("div","detail"),search=this._node("div","search");
      const input=this._node("input");input.type="search";input.placeholder="Song oder Künstler suchen";
      input.value=this._query;input.addEventListener("input",()=>this._query=input.value);
      const play=this._node("button","small","▶ Starten");play.type="button";
      play.addEventListener("click",()=>this._start("play_query"));
      input.addEventListener("keydown",e=>{if(e.key==="Enter")play.click()});
      const add=this._node("button","small","+ Vormerken");add.type="button";
      add.addEventListener("click",()=>this._start("enqueue"));
      search.append(input,play,add);detail.append(search);
      const heading=this._node("div","qhead");
      heading.append(this._node("strong",null,"Als Nächstes"),this._node("span",null,total+" Titel"));detail.append(heading);
      const list=this._node("div","qlist");
      items.forEach((t,i)=>{
        const row=this._node("div","qrow");row.append(this._node("span","num",i+1));
        const song=this._node("div","song");
        song.append(this._node("div","song-title",t.title||"Unbekannt"),
          this._node("div","song-artist",t.artist||""));row.append(song);
        const buttons=this._node("div","actions");
        buttons.append(
          this._iconBtn("mdi:arrow-up","Nach oben",
            ()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i-1}),i===0),
          this._iconBtn("mdi:arrow-down","Nach unten",
            ()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i+1}),i>=total-1),
          this._iconBtn("mdi:close","Entfernen",
            ()=>this._call("youtube_music_live","queue_remove",{index:i}))
        );row.append(buttons);list.append(row);
      });
      if(!items.length)list.append(this._node("div","song-artist","Keine Folgetitel"));
      detail.append(list);
      if(items.length){
        const bottom=this._node("div","qhead"),clear=this._node("button","small","Warteschlange leeren");
        clear.type="button";clear.addEventListener("click",async()=>{
          if(!window.confirm("Alle vorgemerkten Titel entfernen?"))return;
          try{await this._call("youtube_music_live","queue_clear")}catch(e){this._error(e)}
        });
        bottom.append(clear);
        if(q?.attributes?.queue_truncated)bottom.append(this._node("span",null,"Erste 40 von "+total));
        detail.append(bottom);
      }
      card.append(detail);
    }
    card.append(this._node("div","feedback status"));root.append(card);
  }
}
if(!customElements.get("ultra-slim-music-card"))customElements.define("ultra-slim-music-card",UltraSlimMusicCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="ultra-slim-music-card")){
  window.customCards.push({type:"ultra-slim-music-card",name:"Soundbar mit YouTube Music",
    description:"Soundbar und Wiedergabe-Warteschlange in einer Karte"});
}
