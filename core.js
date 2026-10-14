export const KEY = 'hermes.local.v1';
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const PAGE_SIZE = 2400;
export const uid = () => crypto.randomUUID();
export const freshState = () => ({version:1, profile:null, pins:[], routes:[], groups:[], journal:[{id:uid(),text:'',createdAt:Date.now()}], settings:{layer:'dark'}});
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateUsername(value){return /^[a-zA-Z0-9_]{3,20}$/.test(value)?'':'Use 3–20 letters, numbers, or underscores.';}
export function renameWait(profile,now=Date.now()){return Math.max(0,WEEK-(now-profile.renamedAt));}
export function coordinates(value){const pair=value.trim().split(/[,\s]+/).map(Number);return pair.length===2&&pair.every(Number.isFinite)&&Math.abs(pair[0])<=90&&Math.abs(pair[1])<=180?pair:null;}
export function canShareLocation(profile,group){return Boolean(profile?.shareLocation&&group?.shareLocation&&group.members.some(m=>m.id===profile.id));}
export function leaveGroup(group,id){const members=group.members.filter(m=>m.id!==id).sort((a,b)=>a.joinedAt-b.joinedAt);return {...group,members,leaderId:group.leaderId===id?(members[0]?.id??null):group.leaderId};}
export function paginate(text,max=PAGE_SIZE){const pages=[];while(text.length>max){let cut=text.lastIndexOf('\n',max-1);if(cut<max/2)cut=text.lastIndexOf(' ',max-1);if(cut<max/2)cut=max;else cut+=1;pages.push(text.slice(0,cut));text=text.slice(cut);}pages.push(text);return pages;}
export function loadState(storage=localStorage){const raw=storage.getItem(KEY);if(!raw)return freshState();const state=JSON.parse(raw);if(state.version!==1||!Array.isArray(state.pins)||!Array.isArray(state.groups)||!Array.isArray(state.journal)||!state.journal.length||!state.settings)throw new Error('Unrecognized local data');return state;}
export function saveState(state,storage=localStorage){storage.setItem(KEY,JSON.stringify(state));}
export function locationFresh(location,now=Date.now()){return Boolean(location&&Number.isFinite(location.timestamp)&&now-location.timestamp>=-5000&&now-location.timestamp<60000);}
export function sosText(location,note=''){if(!locationFresh(location))throw new Error('A fresh GPS location is required.');return `HERMES SOS — I need urgent assistance. My location at ${new Date(location.timestamp).toLocaleString()} was ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (GPS accuracy ±${Math.round(location.accuracy)} m).\nhttps://www.google.com/maps?q=${location.lat},${location.lng}\n${note?`Note: ${note}\n`:''}Please contact me and get help. This is a manually shared SOS; HERMES has not contacted emergency services.`;}
