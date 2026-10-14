import {escapeHTML as esc} from './core.js';
const KEY='hermes.updates.v1';
export const RELEASES=[
 {version:'0.3.5',changes:['Update notifications now keep the previous and new versions plus release notes.','Desktop photorealistic flight: WASD movement, arrow-key looking, R/F altitude and Space or Shift boost.','Level forward flight, surface clearance and gentle near-ground view correction on mobile and desktop.']},
 {version:'0.3.4',changes:['Named pins, colored paths and shaded zones in photorealistic 3D.','Show or hide saved markings while exploring.']},
 {version:'0.3.3',changes:['Restored the original 2D map renderer and improved map recovery after tab changes and rotation.']},
 {version:'0.3.2',changes:['Persistent map diagnostics and basic-map recovery.']},
 {version:'0.3.1',changes:['Import markings into your current personal or shared group map.']}
];
const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return (x.map((v,i)=>v-y[i]).find(v=>v!==0)||0)>0;};
export function updateHistory(storage,version,{existingUser=false}={}){
 let state;try{state=JSON.parse(storage.getItem(KEY))||{};}catch{state={};}
 if(!state||typeof state!=='object'||Array.isArray(state))state={};
 if(!/^\d+\.\d+\.\d+$/.test(state.lastVersion||''))delete state.lastVersion;if(!/^\d+\.\d+\.\d+$/.test(state.pendingFrom||''))delete state.pendingFrom;
 state.items=Array.isArray(state.items)?state.items.filter(n=>n&&typeof n.to==='string'&&Array.isArray(n.releases)&&n.releases.every(r=>r&&typeof r.version==='string'&&Array.isArray(r.changes))).slice(0,20):[];
 const previous=state.lastVersion||state.pendingFrom;
 let added=false;
 if((previous&&newer(version,previous))||(!previous&&existingUser)){
  if(!state.items.some(n=>n.to===version)){state.items.unshift({from:previous||null,to:version,installedAt:Date.now(),read:false,releases:RELEASES.filter(r=>!newer(r.version,version)&&(!previous?r.version===version:newer(r.version,previous)))});added=true;}
 }
 if(!previous||!newer(previous,version)){state.lastVersion=version;delete state.pendingFrom;}
 const save=()=>{try{storage.setItem(KEY,JSON.stringify(state));}catch{}};save();
 return {added,unread:()=>state.items.filter(n=>!n.read).length,remember:()=>{state.pendingFrom=version;save();},html(){const html=state.items.map(n=>'<article class="card update-notice"><h3>HERMES updated</h3><p class="mono">'+esc(n.from||'Previous version not recorded')+' &rarr; '+esc(n.to)+'</p>'+n.releases.map(r=>'<h4>Version '+esc(r.version)+'</h4><ul>'+r.changes.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>').join('')+'</article>').join('');state.items.forEach(n=>n.read=true);save();return html;}};
}
