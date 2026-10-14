import {flightControls} from './flight-controls.js';
import {cesiumIonToken} from './cesium-config.js';
import {escapeHTML as esc} from './core.js';
const CESIUM_BASE='https://cesium.com/downloads/cesiumjs/releases/1.146/Build/Cesium/';
const loaded=new Map();
function loadScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  if(loaded.has(src))return loaded.get(src);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;
    const timer=setTimeout(()=>{script.remove();loaded.delete(src);reject(new Error('The 3D engine could not load. Check your connection.'));},20000);
    script.onload=()=>{clearTimeout(timer);resolve(window[globalName]);};
    script.onerror=()=>{clearTimeout(timer);script.remove();loaded.delete(src);reject(new Error('The 3D engine could not load. Check your connection.'));};
    document.head.append(script);
  });loaded.set(src,promise);return promise;
}
function loadCSS(href){if(!document.querySelector(`link[href="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}}
export function openExplore3D({center,pins=[],deviceLocation=()=>null,onReturn=()=>{}}){
  const dialog=document.createElement('dialog');dialog.className='fly-dialog';dialog.setAttribute('aria-label','3D area explorer');
  dialog.innerHTML=`<header class="fly-header"><div><span class="eyebrow">HERMES / AREA EXPLORER</span><h2>Change your perspective.</h2></div><button type="button" class="button secondary" id="fly-close">Back to map</button></header>
    <div class="fly-options"><button type="button" class="button primary" id="fly-free">Free 3D buildings</button><button type="button" class="button secondary" id="fly-photo">Photorealistic 3D</button><button type="button" class="small-button" id="fly-reset">Reset view</button><button type="button" class="small-button" id="fly-return">Use view on map</button></div>
    <form id="fly-key-form" class="fly-key-form" hidden><p>Photorealistic buildings and terrain use a separate map provider. A Firebase key will not work here. Provider terms, coverage, and usage charges apply.</p><div class="form-row"><div><label for="fly-provider">Provider</label><select id="fly-provider"><option value="ion">Cesium ion access token</option><option value="google">Google Map Tiles API key</option></select></div><div><label for="fly-key">Your map token / key</label><input id="fly-key" type="password" autocomplete="off" spellcheck="false" required placeholder="Paste your restricted browser token"></div></div><div class="actions"><a href="https://ion.cesium.com/tokens" target="_blank" rel="noopener noreferrer">Get a Cesium token ↗</a><button class="button primary" type="submit">Load photorealistic scene</button></div><small>Used in memory for this visit only. Enable Google Photorealistic 3D Tiles in your Cesium account, or enable Map Tiles API for your Google key. Restrict it to your site.</small></form>
    <div class="fly-stage"><div id="fly-canvas"></div><div id="fly-status" class="fly-status" role="status">Loading the 3D viewer…</div><div id="fly-readout" class="fly-readout"></div><div class="flight-joystick"><div id="flight-stick" role="group" aria-label="Movement joystick"><span></span><small>MOVE</small></div><button type="button" id="flight-boost" aria-pressed="false">Fly faster</button></div><div class="flight-pad" aria-label="Flight controls">${[['left','←','Move left'],['forward','↑','Move forward'],['right','→','Move right'],['back','↓','Move backward'],['rise','＋','Rise / zoom out'],['lower','−','Lower / zoom in'],['turn-left','↶','Turn left'],['turn-right','↷','Turn right'],['look-up','⌃','Look up'],['look-down','⌄','Look down']].map(([key,label,title])=>`<button type="button" data-flight="${key}" aria-label="${title}" title="${title}">${label}</button>`).join('')}</div></div>
    <footer class="fly-footer"><p id="fly-description">Free map geometry: building outlines and approximate heights, not photo-realistic surfaces or interiors.</p><small>Drag to move · right-drag / two fingers to tilt · WASD move · Q/E turn · R/F height · arrows look. Left joystick moves ? drag scene to look in photorealistic mode ? pinch to zoom ? Fly faster boosts speed. Imagery does not establish current safety.</small></footer>`;
  document.body.append(dialog);dialog.showModal();
  const $=s=>dialog.querySelector(s);let engine=null,mode='free',generation=0,frame,closed=false,lastFrame=performance.now(),lastCenter={...center},surfaceHeight=0;
  const controls=flightControls(dialog,()=>mode==='photo');
  const status=(message,error=false)=>{if(closed)return;$('#fly-status').textContent=message;$('#fly-status').hidden=!message;$('#fly-status').classList.toggle('error',error);};
  function disposeEngine(){controls.reset();if(engine){mode==='free'?engine.remove():engine.destroy();engine=null;}}
  function updateReadout(){if(!engine)return;if(mode==='free'){const c=engine.getCenter();lastCenter={lat:c.lat,lng:c.lng};$('#fly-readout').textContent=`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} · tilt ${Math.round(engine.getPitch())}°`;}else{const C=window.Cesium,p=engine.camera.positionCartographic;lastCenter={lat:C.Math.toDegrees(p.latitude),lng:C.Math.toDegrees(p.longitude)};$('#fly-readout').textContent=`${lastCenter.lat.toFixed(5)}, ${lastCenter.lng.toFixed(5)} · altitude ${Math.round(p.height)} m`;}}
  function reset(){controls.reset();if(!engine)return;if(mode==='free')engine.flyTo({center:[center.lng,center.lat],zoom:16.8,pitch:64,bearing:-20,duration:800});else{const C=window.Cesium;engine.camera.flyTo({destination:C.Cartesian3.fromDegrees(center.lng,center.lat-.003,surfaceHeight+450),orientation:{heading:0,pitch:C.Math.toRadians(-32),roll:0},duration:1});}}
  async function free(){const attempt=++generation;disposeEngine();mode='free';$('#fly-key-form').hidden=true;$('#fly-free').className='button primary';$('#fly-photo').className='button secondary';$('#fly-description').textContent='Free map geometry: building outlines and approximate heights, not photo-realistic surfaces or interiors.';status('Loading free 3D map data…');
    try{loadCSS('./vendor/maplibre-gl.css');const M=await loadScript('./vendor/maplibre-gl.js','maplibregl');if(closed||attempt!==generation)return;
      engine=new M.Map({container:$('#fly-canvas'),style:'https://tiles.openfreemap.org/styles/liberty',center:[center.lng,center.lat],zoom:16.8,pitch:64,bearing:-20,maxPitch:85,maxZoom:21,attributionControl:{compact:false},canvasContextAttributes:{antialias:true}});
      const active=engine;active.keyboard.disable();active.touchZoomRotate.enableRotation();
      active.on('error',()=>{if(attempt===generation)status('3D map data could not load. Check your connection, then retry Free 3D buildings.',true);});
      active.on('load',()=>{if(closed||attempt!==generation)return;
        const style=active.getStyle();const source=style.sources.openmaptiles?'openmaptiles':Object.keys(style.sources).find(key=>style.sources[key].type==='vector');
        if(!source){status('This map style has no building geometry source.',true);return;}
        for(const layer of style.layers)if(layer['source-layer']==='building'&&layer.type!=='symbol')active.setLayoutProperty(layer.id,'visibility','none');
        const before=style.layers.find(l=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
        active.addLayer({id:'hermes-buildings-3d',source,'source-layer':'building',type:'fill-extrusion',minzoom:13,paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],8],0,'#7d947e',60,'#b8cda6',150,'#d9e7c1'],'fill-extrusion-height':['max',2,['coalesce',['get','render_height'],8]],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.92}},before);
        for(const p of pins){const node=document.createElement('div');node.className='fly-poi';node.textContent='⌖';new M.Marker({element:node}).setLngLat([p.lng,p.lat]).setPopup(new M.Popup().setText(p.name)).addTo(active);}
        active.on('click','hermes-buildings-3d',event=>{const feature=event.features?.[0];if(!feature)return;const info=feature.properties||{};new M.Popup().setLngLat(event.lngLat).setText(`${info.name||'Mapped building'} · map-model height ${Math.round(Number(info.render_height)||8)} m. Height may be estimated. No interior or current-condition data.`).addTo(active);});
        status('');updateReadout();$('#fly-canvas').focus({preventScroll:true});
      });active.on('move',updateReadout);
    }catch(error){if(attempt===generation)status(error.message||'3D requires WebGL support in your browser.',true);}
  }
  async function photoreal(event,useConfigured=false){event?.preventDefault();const fix=deviceLocation();if(fix)center={lat:fix.lat,lng:fix.lng};const token=useConfigured?cesiumIonToken:$('#fly-key').value.trim();if(!token)return;const provider=useConfigured?'ion':$('#fly-provider').value;const attempt=++generation;disposeEngine();mode='photo';$('#fly-key-form').hidden=true;$('#fly-free').className='button secondary';$('#fly-photo').className='button primary';$('#fly-description').textContent='Photorealistic imagery: coverage, resolution, and imagery age vary. No verified interiors or live conditions.';status('Loading photorealistic 3D…');
    try{window.CESIUM_BASE_URL=CESIUM_BASE;loadCSS(CESIUM_BASE+'Widgets/widgets.css');const C=await loadScript(CESIUM_BASE+'Cesium.js','Cesium');if(closed||attempt!==generation)return;
      C.Ion.defaultAccessToken=provider==='ion'?token:'';
      engine=new C.Viewer($('#fly-canvas'),{globe:false,baseLayer:false,geocoder:false,baseLayerPicker:false,animation:false,timeline:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,requestRenderMode:false});
      const controller=engine.scene.screenSpaceCameraController;if(controller)for(const key of ['enableTranslate','enableZoom','enableRotate','enableTilt','enableLook'])controller[key]=false;
      engine.resolutionScale=Math.min(window.devicePixelRatio||1,1.5)/(window.devicePixelRatio||1);
      engine.camera.setView({destination:C.Cartesian3.fromDegrees(center.lng,center.lat-.003,350),orientation:{heading:0,pitch:C.Math.toRadians(-32),roll:0}});
      let tiles;
      if(provider==='google')tiles=await C.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(token)}`,{showCreditsOnScreen:true,maximumScreenSpaceError:16});
      else tiles=await C.createGooglePhotorealistic3DTileset({onlyUsingWithGoogleGeocoder:true},{showCreditsOnScreen:true,maximumScreenSpaceError:16});
      if(closed||attempt!==generation){tiles.destroy();return;}
      engine.scene.primitives.add(tiles);
      const scene=engine.scene;
      if(scene.sampleHeightSupported){try{const samples=await Promise.race([scene.sampleHeightMostDetailed([C.Cartographic.fromDegrees(center.lng,center.lat)]),new Promise(resolve=>setTimeout(()=>resolve([]),10000))]);if(closed||attempt!==generation)return;if(Number.isFinite(samples[0]?.height))surfaceHeight=samples[0].height;}catch{surfaceHeight=0;}}
      if(closed||attempt!==generation)return;
      engine.camera.setView({destination:C.Cartesian3.fromDegrees(center.lng,center.lat-.003,surfaceHeight+450),orientation:{heading:0,pitch:C.Math.toRadians(-32),roll:0}});
      tiles.tileFailed.addEventListener(()=>status('Some 3D imagery could not load. Check provider access, quotas, and coverage.',true));
      for(const p of pins)engine.entities.add({position:C.Cartesian3.fromDegrees(p.lng,p.lat,30),point:{pixelSize:10,color:C.Color.fromCssColorString('#d0ec97')},name:p.name});
      status('');updateReadout();$('#fly-canvas').focus({preventScroll:true});
    }catch{if(attempt===generation){status('Photorealistic data could not load. Check your token/key, enabled map asset, billing/quota, allowed URL, and internet connection.',true);$('#fly-key-form').hidden=false;}}
  }
  function animate(now){if(closed)return;const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;const {x,y,turn,height,look,dx,dy,zoom,boost}=controls.sample();if(engine&&(x||y||turn||height||look||dx||dy||zoom)){
    if(mode==='free'){if(x||y)engine.panBy([x*190*dt*boost,y*190*dt*boost],{duration:0});if(turn)engine.setBearing(engine.getBearing()+turn*45*dt);if(height)engine.setZoom(Math.min(21,Math.max(3,engine.getZoom()-height*.8*dt*boost)));if(look)engine.setPitch(Math.min(85,Math.max(0,engine.getPitch()+look*30*dt)));}
    else{const camera=engine.camera,C=window.Cesium,speed=Math.max(2,Math.min(Math.abs(camera.positionCartographic.height-surfaceHeight)*.3,120))*dt*boost;
      if(x||y||height||turn||look||dx||dy||zoom)camera.cancelFlight?.();
      if(x)camera.moveRight(x*speed);if(y)camera.moveBackward(y*speed);
      if(zoom)camera.moveForward(Math.max(-2,Math.min(2,zoom))*Math.max(10,Math.abs(camera.positionCartographic.height-surfaceHeight))*.6);
      if(height){const p=camera.positionCartographic;camera.setView({destination:C.Cartesian3.fromRadians(p.longitude,p.latitude,Math.max(2,p.height+height*speed))});}
      if(turn||look||dx||dy)camera.setView({orientation:{heading:camera.heading+turn*.8*dt+dx*.004,pitch:Math.max(-1.48,Math.min(1.48,camera.pitch+look*.65*dt-dy*.004)),roll:0}});
      if(camera.positionCartographic.height<2){const p=camera.positionCartographic;camera.setView({destination:C.Cartesian3.fromRadians(p.longitude,p.latitude,2)});}updateReadout();}
  }frame=requestAnimationFrame(animate);}frame=requestAnimationFrame(animate);
  $('#fly-free').onclick=free;$('#fly-photo').onclick=event=>photoreal(event,true);$('#fly-key-form').onsubmit=photoreal;$('#fly-reset').onclick=reset;
  $('#fly-return').onclick=()=>{onReturn(lastCenter);dialog.close();};$('#fly-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{closed=true;generation++;cancelAnimationFrame(frame);disposeEngine();controls.destroy();$('#fly-key').value='';if(window.Cesium)window.Cesium.Ion.defaultAccessToken='';dialog.remove();},{once:true});
  free();
}
