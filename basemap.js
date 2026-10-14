const OSM='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const VECTOR='<a href="https://openfreemap.org">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org">OpenMapTiles</a> · '+OSM;
const scripts=new Map();
function script(src,ready){if(ready())return Promise.resolve();if(scripts.has(src))return scripts.get(src);const promise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;const timer=setTimeout(()=>{el.remove();reject(Error('Map renderer timed out.'));},15000);el.onload=()=>{clearTimeout(timer);ready()?resolve():reject(Error('Map renderer unavailable.'));};el.onerror=()=>{clearTimeout(timer);el.remove();reject(Error('Map renderer unavailable.'));};document.head.append(el);});scripts.set(src,promise);promise.catch(()=>scripts.delete(src));return promise;}
export function basemapController(map,{notice=document.querySelector('#map-error'),standalone=!!navigator.standalone||matchMedia('(display-mode: standalone)').matches}={}){
 let pendingSet=null,frame=0,lastVisible=null;const visible=()=>{const rect=map.getContainer().getBoundingClientRect();return !document.hidden&&rect.width>0&&rect.height>0;};
 const history=[];let lastError='',firstError='';function record(error){lastError=String(error||'Map did not finish loading.').slice(0,1000);firstError||=lastError;if(history.at(-1)?.message===lastError)return;history.push({time:new Date().toISOString(),message:lastError});if(history.length>12)history.shift();}
 let layer=null,generation=0,timer,mode='dark',failed=false,vectorTried=false,lastResume=0,vector=false;
 function message(text,retry=true){notice.replaceChildren();notice.hidden=!text;if(!text)return;const label=document.createElement('span');label.textContent=text;notice.append(label);if(retry){const button=document.createElement('button');button.type='button';button.className='small-button';button.textContent='Retry map';button.onclick=()=>set(mode);notice.append(button);const details=document.createElement('button');details.type='button';details.className='small-button';details.textContent='Show diagnostics';details.dataset.action='diagnostics';notice.append(details);}}
 function clear(){clearTimeout(timer);if(layer){map.removeLayer(layer);layer=null;}map.getContainer().classList.remove('vector-map');}
 function problem(detail=''){if(detail)record(detail);failed=true;map.getContainer().dataset.basemap='unavailable';message('Map imagery is unavailable. Your saved pins and sketches are still here. Check your connection or retry.'+(detail?' '+detail:''));}
 async function useVector(attempt,backup){vectorTried=true;clearTimeout(timer);message('Loading '+(backup?'backup ':'')+'street map…',false);
  try{if(!document.querySelector('link[data-maplibre]')&&!document.querySelector('link[href="./vendor/maplibre-gl.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='./vendor/maplibre-gl.css';css.dataset.maplibre='';document.head.append(css);}
   await script('./vendor/maplibre-gl.js',()=>!!window.maplibregl);if(attempt!==generation)return;
   clear();vector=true;map.getContainer().classList.add('vector-map');
   // Keep WebGL out of Leaflet's translated/scaled panes. Safari composites this
   // fixed viewport just like the standalone 3D viewer; Leaflet owns interaction.
   const viewport=document.createElement('div');viewport.className='native-basemap';
   viewport.style.cssText='position:absolute;inset:0;z-index:0;pointer-events:none';
   map.getContainer().prepend(viewport);
   const satellite=mode==='satellite'&&!backup;
   const style=satellite?{version:8,sources:{imagery:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19}},layers:[{id:'imagery',type:'raster',source:'imagery'}]}:'https://tiles.openfreemap.org/styles/'+(mode==='dark'?'dark':'liberty');
   const center=map.getCenter();
   let gl;
   try{gl=new maplibregl.Map({container:viewport,style,center:[center.lng,center.lat],zoom:map.getZoom()-1,interactive:false,attributionControl:false,pixelRatio:Math.min(devicePixelRatio||1,2),maxZoom:22,renderWorldCopies:true});}catch(error){viewport.remove();throw error;}
   const attribution=satellite?'Tiles &copy; Esri - Esri, Maxar, Earthstar Geographics, GIS User Community':VECTOR;
   const sync=()=>{const c=map.getCenter();gl.jumpTo({center:[c.lng,c.lat],zoom:map.getZoom()-1});};
   const resize=()=>{gl.resize();sync();gl.triggerRepaint();};
   const NativeLayer=L.Layer.extend({onAdd(){map.on('move zoom',sync);map.on('resize',resize);map.attributionControl?.addAttribution(attribution);},onRemove(){map.off('move zoom',sync);map.off('resize',resize);map.attributionControl?.removeAttribution(attribution);gl.remove();viewport.remove();},getMaplibreMap(){return gl;}});
   layer=new NativeLayer().addTo(map);
   map.getContainer().dataset.basemap='vector-loading';
   timer=setTimeout(()=>{if(attempt===generation)problem(lastError);},18000);
   const ready=()=>{if(attempt!==generation||!gl.isStyleLoaded()||!gl.areTilesLoaded())return;clearTimeout(timer);failed=false;map.getContainer().dataset.basemap='vector';message(backup&&mode==='satellite'?'Satellite unavailable. Showing a backup street map.':'',false);};
   gl.on('load',()=>{resize();ready();});gl.on('idle',ready);
   gl.on('error',event=>{record(event.error?.message||'Map data could not be loaded.');map.getContainer().dataset.mapError=lastError;if(attempt===generation&&map.getContainer().dataset.basemap!=='vector')problem(lastError);});
   gl.on('webglcontextlost',()=>{if(attempt===generation)problem('The map graphics context was interrupted.');});
   gl.on('webglcontextrestored',resize);

  }catch(error){if(attempt!==generation)return;record(error?.message||'Map renderer unavailable.');if(!backup){clear();raster(attempt);}else problem(lastError);}
 }
 function raster(attempt){vector=false;let loaded=0,errors=0;map.getContainer().dataset.basemap='raster-loading';const satellite=mode==='satellite';
  layer=L.tileLayer(satellite?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:satellite?'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics, GIS User Community':OSM,maxZoom:20,maxNativeZoom:19,keepBuffer:1,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin'});
  const active=layer;
  const recover=()=>{if(attempt!==generation)return;if(!vectorTried&&navigator.onLine)useVector(attempt,true);else problem(lastError||'The map image requests failed.');};
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!loaded)recover();},12000);};
  layer.on('loading',()=>{loaded=errors=0;arm();});layer.on('tileerror',event=>{if(attempt!==generation||layer!==active)return;record('Image request failed: '+(event.tile?.src||'map tile'));if(++errors>=3)recover();});layer.on('tileload',()=>{if(attempt!==generation||layer!==active)return;loaded++;failed=false;map.getContainer().dataset.basemap='raster';message('');});layer.on('load',()=>{if(attempt!==generation||layer!==active)return;clearTimeout(timer);if(!loaded&&errors)recover();});layer.addTo(map);arm();
 }
 function set(name,{forceVector=false,forceRaster=false}={}){if(!visible()){pendingSet={name,options:{forceVector,forceRaster}};return;}pendingSet=null;const attempt=++generation;clear();mode=['dark','street','satellite'].includes(name)?name:'dark';failed=false;vectorTried=forceRaster;map.getContainer().classList.toggle('night-map',mode==='dark');message('');map.invalidateSize({pan:false});if(!forceRaster&&forceVector)useVector(attempt,forceVector&&mode==='satellite');else raster(attempt);}
 function resume(){
  cancelAnimationFrame(frame);if(!visible())return;
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   if(!visible())return;
   if(pendingSet){const pending=pendingSet;set(pending.name,pending.options);}
   map.invalidateSize({pan:false});
   if(vector){const gl=layer?.getMaplibreMap?.();gl?.resize();gl?.triggerRepaint();}
   const rect=map.getContainer().getBoundingClientRect();lastVisible={time:new Date().toISOString(),width:rect.width,height:rect.height,state:map.getContainer().dataset.basemap};
   if(failed&&navigator.onLine&&Date.now()-lastResume>5000){lastResume=Date.now();set(mode);}
  });});
 }
 window.addEventListener('pageshow',resume);window.addEventListener('online',resume);window.addEventListener('resize',resume);window.addEventListener('orientationchange',resume);window.visualViewport?.addEventListener('resize',resume);document.addEventListener('visibilitychange',resume);
 // Hidden tabs have a zero-sized layout. Preserve the last valid camera and only
 // resize either renderer once the map is visible and layout has settled.
 const observer=new ResizeObserver(resume);observer.observe(map.getContainer());

 return {set,resume,diagnostics(){const el=map.getContainer(),rect=el.getBoundingClientRect(),gl=layer?.getMaplibreMap?.();return {mode,standalone,visible:visible(),lastVisible,state:el.dataset.basemap,renderer:vector?'MapLibre':'Leaflet images',viewport:{width:rect.width,height:rect.height},canvas:[...el.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,displayWidth:c.clientWidth,displayHeight:c.clientHeight,contextLost:c.getContext('webgl2')?.isContextLost?.()??null})),styleLoaded:gl?.isStyleLoaded?.()??null,tilesLoaded:gl?.areTilesLoaded?.()??null,firstError,lastError,errors:history.slice()};},destroy(){generation++;cancelAnimationFrame(frame);clear();observer.disconnect();window.removeEventListener('resize',resume);window.removeEventListener('orientationchange',resume);window.visualViewport?.removeEventListener('resize',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);}};
}
