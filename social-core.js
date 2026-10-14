export const MAX_MEMBERS=20;
export const LIVE_AGE=90000;
export const nameKey=name=>String(name).trim().toLowerCase();
export const millis=value=>value?.toMillis?.()??(Number.isFinite(value)?value:0);
export function livePosition(p,now=Date.now()){
  return p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180&&Number.isFinite(p.accuracy)&&p.accuracy>=0&&now-p.measuredAt>=-5000&&now-p.measuredAt<LIVE_AGE;
}
export function membershipAfterLeaving(members,uid){const ids=members.filter(id=>id!==uid);return {memberIds:ids,leaderId:ids[0]||null};}
export function safePhoto(value){return typeof value==='string'&&value.length<=90000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:null;}
export function encodeMark(mark,kind){
  return {kind:kind==='pin'?'pin':mark.kind==='zone'?'zone':'path',name:String(mark.name).slice(0,80),notes:String(mark.notes||'').slice(0,4000),lat:kind==='pin'?mark.lat:0,lng:kind==='pin'?mark.lng:0,points:JSON.stringify(kind==='pin'?[]:mark.points),color:/^#[0-9a-f]{6}$/i.test(mark.color)?mark.color:'#d0ec97',markerType:['spot','meet','exit','avoid','note'].includes(mark.type)?mark.type:'spot'};
}
export function decodeMark(id,scope,m){
  if(!m||typeof m.name!=='string'||typeof m.notes!=='string')return null;
  const common={id,scope,name:m.name.slice(0,80),notes:m.notes.slice(0,4000),createdAt:millis(m.createdAt),cloud:true};
  if(m.kind==='pin')return Number.isFinite(m.lat)&&Math.abs(m.lat)<=90&&Number.isFinite(m.lng)&&Math.abs(m.lng)<=180?{...common,lat:m.lat,lng:m.lng,type:['spot','meet','exit','avoid','note'].includes(m.markerType)?m.markerType:'spot'}:null;
  try{const points=JSON.parse(m.points);if(!Array.isArray(points)||points.length<2||points.length>500||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>90||Math.abs(p[1])>180))return null;return {...common,points,kind:m.kind==='zone'?'zone':'path',color:/^#[0-9a-f]{6}$/i.test(m.color)?m.color:'#d0ec97'};}catch{return null;}
}
export function inviteFromURL(input,base=globalThis.location?.href||'https://example.invalid/'){
  try{const u=new URL(input,base),params=new URLSearchParams(u.hash.slice(1));const group=params.get('join'),friend=params.get('friend');if(group&&/^[a-f0-9]{48}$/.test(group))return {kind:'group',token:group};if(friend&&/^[a-z0-9_]{3,20}$/.test(friend))return {kind:'friend',username:friend};}catch{}return null;
}
