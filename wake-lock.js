export function keepScreenAwake({nav=navigator,doc=document,win=window}={}){
 let lock=null,pending=false,stopped=false,lastAttempt=0;
 async function acquire(force=false){if(stopped||doc.visibilityState!=='visible'||!nav.wakeLock||pending||(lock&&!lock.released)||(!force&&Date.now()-lastAttempt<5000))return;pending=true;lastAttempt=Date.now();try{const next=await nav.wakeLock.request('screen');if(stopped||doc.visibilityState!=='visible'){await next.release();return;}lock=next;doc.documentElement.dataset.screenAwake='true';next.addEventListener('release',()=>{if(lock===next){lock=null;doc.documentElement.dataset.screenAwake='false';}},{once:true});}catch{doc.documentElement.dataset.screenAwake='false';}finally{pending=false;}}
 const visible=()=>{if(doc.visibilityState==='visible')acquire(true);},gesture=()=>acquire(),hide=()=>{const old=lock;lock=null;old?.release().catch(()=>{});};
 doc.addEventListener('visibilitychange',visible);doc.addEventListener('pointerdown',gesture,{passive:true});win.addEventListener('pageshow',visible);win.addEventListener('pagehide',hide);acquire(true);
 return ()=>{stopped=true;hide();doc.removeEventListener('visibilitychange',visible);doc.removeEventListener('pointerdown',gesture);win.removeEventListener('pageshow',visible);win.removeEventListener('pagehide',hide);};
}
