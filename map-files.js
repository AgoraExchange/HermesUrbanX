import {uid} from './core.js';import {validMarkingPoints,markingColor} from './markings.js';
export const MAX_MAP_BYTES=5*1024*1024;
const text=(v,n)=>{if(typeof v!=='string'||v.length>n)throw Error('Map contains invalid text.');return v;};
export function readMapFile(raw){
 if(typeof raw!=='string'||new Blob([raw]).size>MAX_MAP_BYTES)throw Error('Choose a HERMES map file smaller than 5 MB.');let file;try{file=JSON.parse(raw);}catch{throw Error('This is not a valid JSON map file.');}
 if(file?.format!=='hermes-map'||file.version!==1||!Array.isArray(file.pins)||!Array.isArray(file.routes)||file.pins.length+file.routes.length>2000)throw Error('Choose a supported HERMES map export (up to 2,000 markings).');
 const name=text(file.name,80).trim()||'Imported map';
 const pins=file.pins.map(p=>{if(!p||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lng)||Math.abs(p.lng)>180)throw Error('A pin has invalid coordinates.');return {name:text(p.name,80),notes:text(p.notes||'',4000),lat:p.lat,lng:p.lng,type:['spot','meet','exit','avoid','note'].includes(p.type)?p.type:'spot',color:markingColor(p.color)};});
 const routes=file.routes.map(r=>{if(!r||!['path','zone'].includes(r.kind)||r.points?.length>500||!validMarkingPoints(r.points,r.kind))throw Error('A path or zone has invalid geometry.');return {name:text(r.name,80),notes:text(r.notes||'',4000),kind:r.kind,color:markingColor(r.color),points:r.points.map(p=>[...p])};});
 return {name,pins,routes};
}
export function exportMap(data,scope,name){const pin=p=>({name:p.name,notes:p.notes||'',lat:p.lat,lng:p.lng,type:p.type,color:markingColor(p.color)}),route=r=>({name:r.name,notes:r.notes||'',kind:r.kind||'path',color:markingColor(r.color),points:r.points.map(p=>[...p])});const file={format:'hermes-map',version:1,name:name.trim().slice(0,80)||'My map',exportedAt:new Date().toISOString(),pins:data.pins.filter(p=>p.scope===scope).map(pin),routes:data.routes.filter(p=>p.scope===scope).map(route)};readMapFile(JSON.stringify(file));return file;}
export function importMap(file,name,target=null){const id=target||'import_'+uid(),createdAt=Date.now();return {map:{id,name:String(name||file.name).trim().slice(0,80)||'Imported map',createdAt},pins:file.pins.map(p=>({...p,id:uid(),scope:id,createdAt})),routes:file.routes.map(r=>({...r,points:r.points.map(p=>[...p]),id:uid(),scope:id,createdAt}))};}
