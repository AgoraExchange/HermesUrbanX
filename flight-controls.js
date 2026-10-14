// Independent pointer ownership lets the left thumb move while the right looks.
export function flightControls(dialog,isPhoto){
 const keys=new Set(),held=new Map(),scene=dialog.querySelector('#fly-canvas'),stick=dialog.querySelector('#flight-stick'),thumb=stick.querySelector('span'),boost=dialog.querySelector('#flight-boost'),pointers=new Map(),listeners=[];
 let stickId=null,x=0,y=0,dx=0,dy=0,zoom=0,fast=false;
 const on=(el,type,fn,options)=>{el.addEventListener(type,fn,options);listeners.push(()=>el.removeEventListener(type,fn,options));};
 const map={KeyW:'forward',KeyS:'back',KeyA:'left',KeyD:'right',KeyR:'rise',KeyF:'lower',KeyQ:'turn-left',KeyE:'turn-right',ArrowLeft:'turn-left',ArrowRight:'turn-right',ArrowUp:'look-up',ArrowDown:'look-down',ShiftLeft:'boost',ShiftRight:'boost'};
 const editable=e=>e.target.closest('input,textarea,select,[contenteditable="true"]');
 on(dialog,'keydown',e=>{if(editable(e))return;if(map[e.code]){e.preventDefault();keys.add(e.code);}});
 on(dialog,'keyup',e=>{if(map[e.code]){e.preventDefault();keys.delete(e.code);}});
 function reset(){keys.clear();held.clear();pointers.clear();stickId=null;x=y=dx=dy=zoom=0;thumb.style.transform='translate(0,0)';stick.classList.remove('engaged');}
 on(window,'blur',reset);on(document,'visibilitychange',reset);on(window,'resize',reset);on(dialog,'focusin',e=>{if(editable(e))reset();});
 function move(e){const r=stick.getBoundingClientRect(),radius=r.width*.32;let a=e.clientX-r.left-r.width/2,b=e.clientY-r.top-r.height/2;const length=Math.hypot(a,b);if(length>radius){a*=radius/length;b*=radius/length;}x=Math.abs(a/radius)<.12?0:a/radius;y=Math.abs(b/radius)<.12?0:b/radius;thumb.style.transform=`translate(${a}px,${b}px)`;}
 on(stick,'pointerdown',e=>{if(stickId!==null)return;e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('engaged');move(e);});
 on(stick,'pointermove',e=>{if(e.pointerId===stickId){e.preventDefault();move(e);}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])on(stick,event,e=>{if(e.pointerId===stickId){stickId=null;x=y=0;thumb.style.transform='translate(0,0)';stick.classList.remove('engaged');}});
 on(boost,'click',()=>{fast=!fast;boost.setAttribute('aria-pressed',String(fast));boost.textContent=fast?'Fast flight':'Fly faster';});
 for(const button of dialog.querySelectorAll('[data-flight]')){on(button,'pointerdown',e=>{e.preventDefault();try{button.setPointerCapture(e.pointerId);}catch{}held.set(e.pointerId,button.dataset.flight);});for(const event of ['pointerup','pointercancel','lostpointercapture'])on(button,event,e=>held.delete(e.pointerId));}
 function metrics(){const p=[...pointers.values()];return {x:p.reduce((n,p)=>n+p.x,0)/p.length,y:p.reduce((n,p)=>n+p.y,0)/p.length,d:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};}
 on(scene,'pointerdown',e=>{if(!isPhoto()||e.button>0||pointers.size>=2)return;e.preventDefault();scene.focus({preventScroll:true});scene.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});}, {capture:true});
 on(scene,'pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const before=metrics();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=metrics();dx+=after.x-before.x;dy+=after.y-before.y;if(before.d>0&&after.d>0)zoom+=Math.log(after.d/before.d);}, {capture:true});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])on(scene,event,e=>pointers.delete(e.pointerId),{capture:true});
 on(scene,'wheel',e=>{if(!isPhoto())return;e.preventDefault();zoom-=Math.max(-200,Math.min(200,e.deltaY))*.002;},{passive:false});
 scene.tabIndex=0;
 return {reset,destroy(){reset();listeners.forEach(fn=>fn());},sample(){const active=new Set([...keys].map(k=>map[k]).concat([...held.values()]));const axis=(a,b)=>Number(active.has(a))-Number(active.has(b));let a=x+axis('right','left'),b=y+axis('back','forward');const length=Math.hypot(a,b);if(length>1){a/=length;b/=length;}const value={x:a,y:b,turn:axis('turn-right','turn-left'),look:axis('look-up','look-down'),height:axis('rise','lower'),dx,dy,zoom,boost:fast||active.has('boost')?3:1};dx=dy=zoom=0;return value;}};
}
