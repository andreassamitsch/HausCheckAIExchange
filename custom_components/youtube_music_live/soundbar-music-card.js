/* Unified native-style Soundbar + YouTube Music dashboard card. No player I/O on render. */
class SoundbarMusicCard extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:"open"});
    this._expanded=false;this._query="";this._signature=null;
    this._dragPosition=false;this._dragVolume=false;
  }
  static getStubConfig(){
    return {type:"custom:soundbar-music-card",
      media_entity:"media_player.youtube_music_live_youtube_music_live",
      queue_entity:"sensor.youtube_music_live_warteschlange",
      radio_entity:"switch.youtube_music_live_automatische_folgetitel",
      soundbar_entity:"media_player.ultra_slim_soundbar",
      power_entity:"media_player.ultra_slim_soundbar_2"};
  }
  setConfig(config){
    if(!config.media_entity||!config.queue_entity||!config.radio_entity||!config.soundbar_entity){
      throw new Error("media_entity, queue_entity, radio_entity und soundbar_entity erforderlich");
    }
    this._config=config;this._signature=null;this._draw();
  }
  getCardSize(){return this._expanded?8:4;}
  connectedCallback(){
    if(!this._timer)this._timer=setInterval(()=>this._tick(),900);
    this._tick();
  }
  disconnectedCallback(){
    if(this._timer){clearInterval(this._timer);this._timer=null;}
  }
  set hass(h){
    this._hass=h;const c=this._config;if(!c)return;
    const ids=[c.media_entity,c.queue_entity,c.radio_entity,c.soundbar_entity,c.power_entity];
    const sig=JSON.stringify(ids.map((id,i)=>{
      const state=h.states[id];if(!state)return null;
      if(i===0)return [state.state,state.attributes.media_title,state.attributes.media_artist,
                       state.attributes.cover_url,state.attributes.entity_picture,state.attributes.media_duration,
                       state.attributes.supported_features];
      if(i===1)return [state.state,state.attributes.queue];
      if(i===2)return state.state;
      return [state.state,state.attributes.volume_level,state.attributes.is_volume_muted];
    }));
    if(sig!==this._signature){
      if(this.shadowRoot.activeElement?.type==="search"){this._tick();return;}
      this._signature=sig;this._draw();
    }
    this._tick();
  }
  _el(tag,cls,txt){
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(txt!==undefined)el.textContent=String(txt);
    return el;
  }
  _icon(name,size=23){
    const ic=this._el("ha-icon");ic.setAttribute("icon",name);
    const px=size+"px";
    ic.style.setProperty("--mdc-icon-size",px);
    ic.style.width=px;ic.style.height=px;
    return ic;
  }
  _button(icon,title,callback,disabled=false){
    const btn=this._el("button","icon-btn");btn.type="button";btn.disabled=disabled;
    btn.title=title;btn.setAttribute("aria-label",title);btn.append(this._icon(icon));
    btn.addEventListener("click",async()=>{
      btn.disabled=true;try{await callback()}catch(e){this._error(e)}
      finally{btn.disabled=disabled}
    });
    return btn;
  }
  _call(domain,action,data){return this._hass.callService(domain,action,data||{});}
  _error(e){
    const note=this.shadowRoot.querySelector(".feedback");
    if(note)note.textContent=String(e?.message||e||"Unbekannter Fehler").slice(0,180);
  }
  _seconds(x){return typeof x==="number"&&Number.isFinite(x)?Math.max(0,x):0;}
  _time(seconds){
    const s=Math.floor(this._seconds(seconds));
    return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
  }
  _progress(){
    const h=this._hass,c=this._config;if(!h||!c)return [0,0];
    const player=h.states[c.media_entity], cast=h.states[c.soundbar_entity];
    if(!player||!["playing","paused","buffering"].includes(player.state))return [0,0];
    const duration=this._seconds(Number(player.attributes.media_duration||0));
    const position=Number(player.attributes.media_position);
    const castPosition=Number(cast?.attributes?.media_position);
    let pos=Number.isFinite(position)?position:(Number.isFinite(castPosition)?castPosition:0);
    const last=player.attributes.media_position_updated_at||cast?.attributes?.media_position_updated_at;
    if(player.state==="playing"&&last){
      const date=Date.parse(last);if(Number.isFinite(date)){
        pos+=Math.max(0,Math.min(6,(Date.now()-date)/1000));
      }
    }
    return [Math.max(0,Math.min(duration||Infinity,pos)),duration];
  }
  _tick(){
    if(this._dragPosition)return;
    const slider=this.shadowRoot.querySelector(".position-slider");
    const left=this.shadowRoot.querySelector(".elapsed");
    const right=this.shadowRoot.querySelector(".duration");
    if(!slider||!left||!right)return;
    const [position,duration]=this._progress();
    slider.max=String(Math.max(1,Math.floor(duration)));
    slider.value=String(Math.min(Math.floor(duration),Math.round(position)));
    left.textContent=this._time(position);
    right.textContent=this._time(duration);
  }
  _draw(){
    const h=this._hass,c=this._config;if(!h||!c)return;
    const player=h.states[c.media_entity],queue=h.states[c.queue_entity],radio=h.states[c.radio_entity],
      sound=h.states[c.soundbar_entity],power=h.states[c.power_entity];
    const tracks=Array.isArray(queue?.attributes?.queue)?queue.attributes.queue:[];
    const count=Number(queue?.state)||tracks.length;
    const playing=player?.state==="playing",paused=player?.state==="paused";
    const hasTrack=!!player&&["playing","paused","buffering"].includes(player.state);
    const [position,duration]=this._progress();
    const vol=Number(sound?.attributes?.volume_level??power?.attributes?.volume_level);
    const pct=Number.isFinite(vol)?Math.max(0,Math.min(100,Math.round(vol*100))):null;
    const muted=!!sound?.attributes?.is_volume_muted;
    const root=this.shadowRoot;root.replaceChildren();
    const style=this._el("style");style.textContent="\n:host{display:block;min-width:0}\nha-card{position:relative;box-sizing:border-box;overflow:hidden;border:1px solid rgba(0,0,0,.07);\n  border-radius:18px;padding:15px;background:linear-gradient(125deg,#068cad,#08749d);\n  color:#fff;box-shadow:none}\nbutton{font:inherit;touch-action:manipulation}\n.heading{display:flex;align-items:center;gap:10px;min-width:0}\n.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:18px;font-weight:580}\n.icon-btn{color:inherit;border:0;background:transparent;border-radius:10px;\n  min-width:42px;width:42px;height:43px;display:grid;place-items:center;cursor:pointer;flex:none}\n.icon-btn:disabled{opacity:.32;cursor:default}\n.icon-btn:not(:disabled):hover,.icon-btn:not(:disabled):focus-visible{background:rgba(255,255,255,.18)}\n.cover-wrap{display:flex;align-items:center;gap:12px;min-height:92px;margin:13px 0 8px}\n.track-info{flex:1;min-width:0}\n.track-title{font-size:18px;font-weight:620;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.track-artist{font-size:13px;opacity:.88;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.cover{height:94px;width:94px;flex:none;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.17);display:grid;place-items:center}\n.cover img{width:100%;height:100%;object-fit:cover;display:block}\n.progress{display:flex;align-items:center;gap:10px;margin:10px 0 3px}\n.time{font-size:12px;opacity:.94;min-width:34px;font-variant-numeric:tabular-nums}\n.time:last-child{text-align:right}\ninput[type=range]{cursor:pointer;accent-color:#fff;flex:1;min-width:0;min-height:28px}\ninput[type=range]:disabled{opacity:.4;cursor:default}\n.controls{display:flex;justify-content:space-around;align-items:center;gap:4px;margin:4px 0}\n.controls .icon-btn{width:49px;height:48px}\n.controls .main{border-radius:50%;height:54px;width:54px;background:rgba(255,255,255,.18)}\n.volume{display:flex;align-items:center;gap:3px;margin:6px 0 0}\n.volume .icon-btn{width:36px;min-width:36px;height:36px}\n.volume-level{font-size:13px;min-width:39px;text-align:right;font-variant-numeric:tabular-nums}\n.footer{display:flex;gap:9px;align-items:center;justify-content:space-between;\nborder-top:1px solid rgba(255,255,255,.29);padding-top:7px;margin-top:10px}\n.show-queue{border:0;background:transparent;display:flex;align-items:center;gap:7px;\ncolor:inherit;cursor:pointer;flex:1;text-align:left;min-height:38px;font-size:13px;padding:3px}\n.radio{font-size:12px;color:white;background:rgba(255,255,255,.13);\nborder:1px solid rgba(255,255,255,.43);border-radius:9px;padding:8px;min-height:35px;cursor:pointer}\n.radio.active{background:rgba(255,255,255,.28)}\n.radio:disabled{opacity:.5}\n.detail{background:var(--card-background-color);color:var(--primary-text-color);\nmargin:12px -15px -15px;padding:14px 15px;border-radius:0 0 17px 17px}\n.search-row{display:flex;gap:7px;flex-wrap:wrap}\n.search-row input{color:var(--primary-text-color);background:var(--card-background-color);font:inherit;font-size:16px;\nborder:1px solid var(--divider-color);border-radius:9px;flex:1;min-width:145px;box-sizing:border-box;padding:10px}\n.qbutton{font:inherit;font-size:13px;cursor:pointer;min-height:40px;border-radius:9px;\nborder:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);padding:8px}\n.qhead{display:flex;align-items:center;justify-content:space-between;margin:16px 0 7px;gap:8px;font-size:14px}\n.queue{max-height:420px;overflow-y:auto}\n.qrow{display:flex;align-items:center;gap:7px;min-height:57px;padding:5px 0;border-bottom:1px solid var(--divider-color)}\n.qnum{font-size:12px;color:var(--secondary-text-color);min-width:19px}\n.qdata{min-width:0;flex:1}\n.qtitle{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.qartist{font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.qactions{display:flex;gap:2px}\n.qactions .icon-btn{border:1px solid var(--divider-color);color:var(--primary-text-color);height:35px;min-width:32px;width:32px;padding:4px}\n.qactions ha-icon{--mdc-icon-size:19px!important;width:19px!important;height:19px!important}\n.feedback{color:var(--error-color);font-size:12px}\n@media(max-width:480px){ha-card{padding:12px}.detail{margin:12px -12px -12px;padding:12px}\n.heading .name{font-size:17px}.cover{width:83px;height:83px}.cover-wrap{min-height:85px}}\n";root.append(style);
    const card=this._el("ha-card");
    const heading=this._el("div","heading");
    heading.append(this._icon("mdi:cast-audio",27),this._el("span","name","Ultra Slim Soundbar"));
    const more=this._button("mdi:dots-vertical","Soundbar-Details",()=>{
      this.dispatchEvent(new CustomEvent("hass-more-info",{
        bubbles:true,composed:true,detail:{entityId:c.soundbar_entity}
      }));
    });
    heading.append(more);card.append(heading);
    const coverRow=this._el("div","cover-wrap"),text=this._el("div","track-info");
    text.append(this._el("div","track-title",hasTrack?(player.attributes.media_title||"Unbekannter Titel"):"Keine Wiedergabe"));
    text.append(this._el("div","track-artist",hasTrack?(player.attributes.media_artist||"YouTube Music"):"YouTube Music Live"));
    coverRow.append(text);
    const cover=this._el("div","cover");
    const attrs=player?.attributes||{};
    const art=attrs.cover_url||attrs.entity_picture||attrs.media_image_url||
      (hasTrack&&attrs.media_content_id?"https://i.ytimg.com/vi/"+attrs.media_content_id+"/hqdefault.jpg":null);
    if(hasTrack&&art&&typeof art==="string"&&(art.startsWith("https://")||art.startsWith("/"))){
      const img=this._el("img");img.src=art;img.alt="Cover";
      img.referrerPolicy="no-referrer";img.loading="lazy";
      img.onerror=()=>{img.remove();cover.append(this._icon("mdi:music-box-multiple",45));};
      cover.append(img);
    }else cover.append(this._icon("mdi:music-box-multiple",45));
    coverRow.append(cover);card.append(coverRow);
    const progress=this._el("div","progress");
    progress.append(this._el("span","time elapsed",this._time(position)));
    const seek=this._el("input","position-slider");seek.type="range";seek.min="0";
    seek.max=String(Math.max(1,Math.floor(duration)));seek.step="1";seek.value=String(Math.round(position));
    seek.disabled=!hasTrack||!duration||!(Number(attrs.supported_features||0)&2);
    seek.setAttribute("aria-label","Titelposition");
    seek.addEventListener("input",()=>{
      this._dragPosition=true;
      const label=this.shadowRoot.querySelector(".elapsed");
      if(label)label.textContent=this._time(Number(seek.value));
    });
    seek.addEventListener("change",async()=>{
      const seconds=Number(seek.value);
      try{await this._call("media_player","media_seek",{entity_id:c.media_entity,seek_position:seconds})}
      catch(e){this._error(e)}
      finally{this._dragPosition=false;this._tick()}
    });
    seek.addEventListener("pointerup",()=>{if(this._dragPosition)setTimeout(()=>{this._dragPosition=false;this._tick()},2500)});
    progress.append(seek,this._el("span","time duration",this._time(duration)));
    card.append(progress);
    const controls=this._el("div","controls");
    if(power&&power.state!=="unavailable"&&power.state!=="unknown"){
      const on=power.state!=="off";
      controls.append(this._button("mdi:power",on?"Soundbar ausschalten":"Soundbar einschalten",
        ()=>this._call("media_player",on?"turn_off":"turn_on",{entity_id:c.power_entity})));
    }
    controls.append(this._button("mdi:stop","Musik vollständig stoppen",
      ()=>this._call("media_player","media_stop",{entity_id:c.media_entity}),!hasTrack));
    const play=this._button(playing?"mdi:pause":"mdi:play",
      playing?"Pause":"Fortsetzen",()=>this._call("media_player",
      playing?"media_pause":"media_play",{entity_id:c.media_entity}),!hasTrack);
    play.classList.add("main");controls.append(play);
    controls.append(this._button("mdi:skip-next","Nächster Titel",
      ()=>this._call("media_player","media_next_track",{entity_id:c.media_entity}),!hasTrack));
    card.append(controls);
    const volume=this._el("div","volume");
    const enabled=pct!==null&&sound&&sound.state!=="unavailable"&&sound.state!=="unknown";
    const setVol=async(next)=>{
      const n=Math.max(0,Math.min(100,next));
      await this._call("media_player","volume_set",{entity_id:c.soundbar_entity,volume_level:Number((n/100).toFixed(2))});
    };
    volume.append(this._button("mdi:minus","Lautstärke minus 1 Prozent",()=>setVol(pct-1),!enabled));
    const slider=this._el("input","volume-slider");
    slider.type="range";slider.min="0";slider.max="100";slider.step="1";
    slider.value=String(pct??0);slider.disabled=!enabled;slider.setAttribute("aria-label","Lautstärke");
    slider.addEventListener("input",()=>{
      this._dragVolume=true;const label=this.shadowRoot.querySelector(".volume-level");
      if(label)label.textContent=slider.value+" %";
    });
    slider.addEventListener("change",async()=>{
      try{await setVol(Number(slider.value))}catch(e){this._error(e)}
      finally{this._dragVolume=false}
    });
    volume.append(slider);
    volume.append(this._button("mdi:plus","Lautstärke plus 1 Prozent",()=>setVol(pct+1),!enabled));
    volume.append(this._el("span","volume-level",pct!==null?pct+" %":"–"));
    card.append(volume);
    const footer=this._el("div","footer");
    const expand=this._el("button","show-queue");expand.type="button";
    expand.append(this._icon(this._expanded?"mdi:chevron-up":"mdi:chevron-down",21),
      this._el("span",null,"Warteschlange · "+count+" Titel"));
    expand.addEventListener("click",()=>{this._expanded=!this._expanded;this._draw()});
    footer.append(expand);
    const radioButton=this._el("button","radio"+(radio?.state==="on"?" active":""),
      radio?.state==="on"?"Radio an":"Radio aus");
    radioButton.type="button";radioButton.disabled=!radio||!hasTrack;
    radioButton.addEventListener("click",async()=>{
      try{await this._call("switch",radio.state==="on"?"turn_off":"turn_on",{entity_id:c.radio_entity})}
      catch(e){this._error(e)}
    });
    footer.append(radioButton);card.append(footer);
    if(this._expanded){
      const detail=this._el("div","detail");
      const search=this._el("div","search-row"),input=this._el("input");
      input.type="search";input.placeholder="Song oder Künstler suchen";input.value=this._query;
      input.addEventListener("input",()=>this._query=input.value);
      const playSong=this._el("button","qbutton","▶ Starten");playSong.type="button";
      playSong.addEventListener("click",()=>this._search("play_query"));
      input.addEventListener("keydown",e=>{if(e.key==="Enter")playSong.click()});
      const add=this._el("button","qbutton","+ Vormerken");add.type="button";
      add.addEventListener("click",()=>this._search("enqueue"));
      search.append(input,playSong,add);detail.append(search);
      const qhead=this._el("div","qhead");
      qhead.append(this._el("strong",null,"Als Nächstes"),this._el("span",null,count+" Titel"));
      detail.append(qhead);
      const list=this._el("div","queue");
      tracks.forEach((t,i)=>{
        const row=this._el("div","qrow");
        row.append(this._el("span","qnum",i+1));
        const info=this._el("div","qdata");
        info.append(this._el("div","qtitle",t.title||"Unbekannt"),
          this._el("div","qartist",t.artist||""));
        row.append(info);
        const buttons=this._el("div","qactions");
        buttons.append(
          this._button("mdi:arrow-up","Nach oben",()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i-1}),i===0),
          this._button("mdi:arrow-down","Nach unten",()=>this._call("youtube_music_live","queue_move",{from_index:i,to_index:i+1}),i>=count-1),
          this._button("mdi:close","Entfernen",()=>this._call("youtube_music_live","queue_remove",{index:i}))
        );
        row.append(buttons);list.append(row);
      });
      if(!tracks.length)list.append(this._el("div","qartist","Keine Folgetitel"));
      detail.append(list);
      if(tracks.length){
        const bottom=this._el("div","qhead");
        const clear=this._el("button","qbutton","Warteschlange leeren");
        clear.type="button";clear.addEventListener("click",async()=>{
          if(!window.confirm("Alle kommenden Titel entfernen?"))return;
          try{await this._call("youtube_music_live","queue_clear")}catch(e){this._error(e)}
        });
        bottom.append(clear);
        if(queue?.attributes?.queue_truncated)bottom.append(this._el("span",null,"Erste 40 von "+count));
        detail.append(bottom);
      }
      card.append(detail);
    }
    card.append(this._el("div","feedback"));
    root.append(card);this._tick();
  }
  async _search(service){
    const query=this._query.trim();if(!query)return;
    try{
      await this._call("youtube_music_live",service,{query,...(service==="play_query"?{radio:true}:{})});
      this._query="";const input=this.shadowRoot.querySelector("input[type=search]");
      if(input)input.value="";
    }catch(e){this._error(e)}
  }
}
if(!customElements.get("soundbar-music-card")){
  customElements.define("soundbar-music-card",SoundbarMusicCard);
}
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="soundbar-music-card")){
  window.customCards.push({type:"soundbar-music-card",name:"Soundbar Music",description:"Soundbar mit YouTube Music Radio und Warteschlange"});
}
