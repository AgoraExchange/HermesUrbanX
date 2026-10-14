import {chromium,expect} from '@playwright/test';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
const store=new Map(),versions=new Map(),errors=[];
const resolve=v=>v==='__SERVER_TIME__'?Date.now():Array.isArray(v)?v.map(resolve):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)])):v;
const sdk=`
const ref=(path,type='doc')=>({path,type});
export const getFirestore=()=>({});
export const doc=(base,...parts)=>ref(parts.length?parts.join('/'):(base.path+'/'+crypto.randomUUID()));
export const collection=(_,...parts)=>ref(parts.join('/'),'collection');
export const where=(field,op,value)=>({kind:'where',field,op,value});
export const orderBy=(field,direction)=>({kind:'order',field,direction});
export const limit=count=>({kind:'limit',count});
export const query=(r,...filters)=>({...r,filters});
export const serverTimestamp=()=>'__SERVER_TIME__';
export const Timestamp={fromMillis:n=>n};
const snap=(path,data,version=0)=>({id:path.split('/').at(-1),ref:ref(path),exists:()=>data!==null,data:()=>data,metadata:{hasPendingWrites:false,fromCache:false},version});
async function read(r){const result=await window.hermesRpc({method:'read',ref:r});return r.type==='collection'?{docs:result.map(d=>snap(d.path,d.data,d.version))}:snap(r.path,result.data,result.version);}
export const getDocFromServer=read,getDocsFromServer=read;
export async function runTransaction(db,fn){for(let i=0;i<5;i++){const writes=[],reads={};const tx={get:async r=>{const s=await read(r);reads[r.path]=s.version;return s;},set:(r,data)=>writes.push({path:r.path,data,type:'set'}),update:(r,data)=>writes.push({path:r.path,data,type:'update'}),delete:r=>writes.push({path:r.path,type:'delete'})};const value=await fn(tx);const result=await window.hermesRpc({method:'commit',reads,writes});if(result.ok)return value;}throw Error('Concurrent write retry failed');}
export function onSnapshot(r,options,next,error){if(typeof options==='function'){error=next;next=options;}let stopped=false,last='';const poll=async()=>{try{const s=await read(r);const encoded=JSON.stringify(s.docs?s.docs.map(d=>[d.id,d.data()]):s.data());if(!stopped&&encoded!==last){last=encoded;next(s);}}catch(e){error?.(e);}};poll();const timer=setInterval(poll,80);return ()=>{stopped=true;clearInterval(timer)};}
`;
const browser=await chromium.launch({headless:true,executablePath:process.env.HERMES_BROWSER||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1234/chrome-win64/chrome.exe')});
async function explorer(id,username,collision=false){
 const context=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:33.749,longitude:-84.388,accuracy:6},permissions:['geolocation']});
 await context.route('https://tile.openstreetmap.org/**',r=>r.abort());await context.route('https://fonts.googleapis.com/**',r=>r.abort());
 await context.exposeBinding('hermesRpc',async(_,req)=>{
  if(req.method==='read'){
   const r=req.ref;if(r.type!=='collection')return {data:store.get(r.path)||null,version:versions.get(r.path)||0};
   let docs=[...store].filter(([p])=>p.startsWith(r.path+'/')&&p.split('/').length===r.path.split('/').length+1).map(([p,data])=>({path:p,data,version:versions.get(p)||0}));
   for(const f of r.filters||[]){if(f.kind==='where')docs=docs.filter(d=>f.op==='array-contains'?d.data[f.field]?.includes(f.value):d.data[f.field]===f.value);if(f.kind==='order')docs.sort((a,b)=>(a.data[f.field]-b.data[f.field])*(f.direction==='desc'?-1:1));if(f.kind==='limit')docs=docs.slice(0,f.count);}return docs;
  }
  if(Object.entries(req.reads).some(([p,v])=>(versions.get(p)||0)!==v))return {ok:false};
  for(const w of req.writes){if(w.type==='delete')store.delete(w.path);else store.set(w.path,{...(w.type==='update'?store.get(w.path):{}),...resolve(w.data)});versions.set(w.path,(versions.get(w.path)||0)+1);}return {ok:true};
 });
 await context.route('https://www.gstatic.com/firebasejs/13.0.0/*',route=>{
  const url=route.request().url();let body=sdk;
  if(url.endsWith('firebase-app.js'))body='export const getApps=()=>[];export const initializeApp=()=>({});';
  if(url.endsWith('firebase-auth.js'))body=`const auth={currentUser:{uid:${JSON.stringify(id)}},authStateReady:async()=>{}};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const browserLocalPersistence={};export const signInAnonymously=async()=>{};export const deleteUser=async()=>{auth.currentUser=null};`;
  return route.fulfill({contentType:'text/javascript',body,headers:{'access-control-allow-origin':'*'}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5188',{waitUntil:'domcontentloaded'});await page.locator('#onboard-name').fill(username);await page.getByRole('button',{name:'Enter the field'}).click();await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Connect explorer profile',exact:true}).click();await page.getByRole('button',{name:'Connect explorer',exact:true}).click();if(collision)await expect(page.locator('#net-connect-status')).toContainText('already taken');else await expect(page.locator('#connection')).toHaveText('Crew connected');return {page,context};
}
await mkdir('test-results',{recursive:true});let a,b,c;
try{
 a=(await explorer('alice','alice_field')).page;b=(await explorer('bob','bob_field')).page;
 await a.getByRole('button',{name:'Groups',exact:true}).click();await a.getByRole('button',{name:'Explorers & friends',exact:true}).click();await a.getByRole('textbox',{name:'Search explorers'}).fill('bob_field');await a.getByRole('button',{name:'Search',exact:true}).click();await a.getByRole('button',{name:'Add explorer',exact:true}).click();
 await b.getByRole('button',{name:/Notifications/}).click();await b.getByRole('button',{name:'Accept',exact:true}).click();await expect.poll(()=>[...store.values()].find(d=>d.from==='alice')?.status).toBe('accepted');await b.getByRole('button',{name:'Close',exact:true}).click();
 await a.getByRole('button',{name:'Close',exact:true}).click();await a.getByRole('button',{name:'Create group',exact:false}).click();await a.locator('#net-new-name').fill('Night crew');await a.locator('#net-group-form').getByRole('button',{name:'Create group',exact:true}).click();await a.getByRole('button',{name:'Open group',exact:true}).click();await a.getByRole('button',{name:'Settings',exact:true}).click();await a.getByRole('button',{name:'Add a friend',exact:true}).click();await a.getByRole('button',{name:'@bob_field',exact:true}).click();await expect(a.locator('#sheet')).toContainText('bob_field');await a.getByRole('button',{name:'Close',exact:true}).click();
 await b.getByRole('button',{name:'Groups',exact:true}).click();await b.getByRole('button',{name:'Open group',exact:true}).click();await b.getByRole('textbox',{name:'Group message',exact:true}).fill('Meet at the north entrance.');await b.getByRole('button',{name:'Send',exact:true}).click();await a.getByRole('button',{name:'Open group',exact:true}).click();await expect(a.locator('#net-chat-log')).toContainText('Meet at the north entrance.');
 await a.getByRole('button',{name:'Open shared map',exact:true}).click();await a.getByRole('button',{name:'Drop a pin',exact:false}).click();await a.getByRole('button',{name:'Use center',exact:true}).click();await a.locator('#pin-name').fill('Emergency meetup');await a.locator('#pin-notes').fill('North entrance beside the wall.');await a.getByRole('button',{name:'Save place',exact:true}).click();
 await b.getByRole('button',{name:'Open shared map',exact:true}).click();await expect(b.locator('.map-pin')).toHaveCount(1);
 await a.getByRole('button',{name:'Sketch a route',exact:true}).click();const box=await a.locator('#map').boundingBox();await a.mouse.click(box.x+90,box.y+210);await a.mouse.click(box.x+220,box.y+250);await a.locator('#drawing-bar').getByRole('button',{name:'Save',exact:true}).click();await a.locator('#route-name').fill('Meetup path');await a.getByRole('button',{name:'Save route',exact:true}).click();await expect(b.locator('.saved-marking')).toHaveCount(1);
 // The first point is still aligned with its tap, and the sketch icon is centered.
 const align=await b.locator('[data-action="draw"]').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('svg').getBoundingClientRect();return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)});expect(align).toBeLessThan(1);
 await b.getByRole('button',{name:'Enable GPS',exact:true}).click();await b.getByRole('button',{name:'Profile',exact:true}).click();await b.locator('#global-sharing').check();await expect.poll(()=>store.get('profiles/bob')?.shareLocation).toBe(true);
 await b.getByRole('button',{name:'Groups',exact:true}).click();await b.getByRole('button',{name:'Open group',exact:true}).click();await b.getByRole('button',{name:'Settings',exact:true}).click();await b.locator('#net-settings-form input[name="sharing"]').check();await b.getByRole('button',{name:'Save settings',exact:true}).click();await expect.poll(()=>[...store.keys()].some(p=>p.endsWith('/locations/bob')),{timeout:25000}).toBe(true);await expect(a.locator('.crew-marker')).toHaveCount(1);
 await b.getByRole('button',{name:'Close',exact:true}).click();await b.getByRole('button',{name:'Profile',exact:true}).click();await b.locator('#global-sharing').uncheck();await expect(a.locator('.crew-marker')).toHaveCount(0);await expect.poll(()=>[...store.keys()].some(p=>p.endsWith('/locations/bob'))).toBe(false);
 // Leader departure transfers to the next joiner and retains the group's map.
 await a.getByRole('button',{name:'Groups',exact:true}).click();await a.getByRole('button',{name:'Open group',exact:true}).click();await a.getByRole('button',{name:'Settings',exact:true}).click();await a.getByRole('button',{name:'Leave group',exact:true}).click();await a.getByRole('button',{name:'Leave group',exact:true}).click();await expect.poll(()=>[...store.values()].find(d=>d.name==='Night crew')?.leaderId).toBe('bob');await expect(a.locator('#sheet')).not.toBeVisible();await expect(a.locator('#groups-view')).not.toContainText('Night crew');
 await b.getByRole('button',{name:'Groups',exact:true}).click();await expect(b.locator('#groups-view')).toContainText('You lead this group');
 // Invite links admit a consenting new explorer without making everyone friends.
 await b.evaluate(()=>{navigator.share=async value=>{window.sharedLink=value.text;};});
 await b.getByRole('button',{name:'Open group',exact:true}).click();await b.getByRole('button',{name:'Settings',exact:true}).click();await b.getByRole('button',{name:'Share group invite',exact:true}).click();await expect.poll(()=>b.evaluate(()=>window.sharedLink||'')).toContain('#join=');const invitation=await b.evaluate(()=>window.sharedLink);await b.getByRole('button',{name:'Close',exact:true}).click();
 const charlie=(await explorer('charlie','charlie_field')).page;await charlie.evaluate(url=>{location.hash=new URL(url).hash;},invitation);await charlie.getByRole('button',{name:'Join group',exact:true}).click();await expect(charlie.locator('#net-chat-log')).toContainText('Meet at the north entrance.');expect(store.get('groups/'+[...store.entries()].find(([k,v])=>k.startsWith('groups/')&&!k.slice(7).includes('/')&&v.name==='Night crew')[0].slice(7)+'/preferences/charlie')?.shareLocation).not.toBe(true);
 // A shared place arrives in a friend's direct conversation and can be saved privately.
 await b.getByRole('button',{name:'View shared map',exact:true}).click();await b.locator('.map-pin').click();await b.getByRole('button',{name:'Share place',exact:true}).click();await b.getByRole('button',{name:'@alice_field',exact:true}).click();await expect(b.locator('#net-chat-log')).toContainText('Shared place: Emergency meetup');await a.getByRole('button',{name:'Open group',exact:true}).click();await a.getByRole('button',{name:'View shared place',exact:true}).click();await a.getByRole('button',{name:'Add to my map',exact:true}).click();expect(await a.evaluate(()=>JSON.parse(localStorage.getItem('hermes.local.v1')).pins.some(p=>p.scope==='personal'&&p.notes==='North entrance beside the wall.'))).toBe(true);
 // Deleting an explorer releases their name and leaves the crew's plans intact.
 await charlie.getByRole('button',{name:'Close',exact:true}).click();await charlie.getByRole('button',{name:'Profile',exact:true}).click();await charlie.getByRole('button',{name:'Delete profile & local data',exact:true}).click();const code=await charlie.locator('.delete-code').textContent();await charlie.locator('#delete-code-input').fill(code);await charlie.getByRole('button',{name:'Confirm deletion',exact:true}).click();await expect(charlie.getByRole('heading',{name:'Welcome to HERMES'})).toBeVisible();expect(store.has('profiles/charlie')).toBe(false);expect(store.has('usernames/charlie_field')).toBe(false);expect([...store.values()].find(v=>v.name==='Night crew').memberIds).toEqual(['bob']);expect([...store.keys()].some(k=>k.includes('/marks/'))).toBe(true);
 // Unique username is enforced by transaction logic, without claiming rule coverage.
 c=(await explorer('duplicate','bob_field',true)).page;expect(store.has('profiles/duplicate')).toBe(false);
 await b.getByRole('button',{name:'Close',exact:true}).click();await b.getByRole('button',{name:'Profile',exact:true}).click();await b.locator('#profile-username').fill('new_bob');await b.getByRole('button',{name:'Save profile',exact:true}).click();await expect(b.locator('#toast')).toContainText('every 7 days');expect(store.get('profiles/bob').username).toBe('bob_field');
 await b.getByRole('button',{name:'Map',exact:true}).click();await b.context().setGeolocation({latitude:33.749,longitude:-84.388,accuracy:6});await b.getByRole('button',{name:'! SOS',exact:true}).click();await b.getByRole('button',{name:'SEND SOS AND LOCATION TO FRIENDS',exact:true}).click();await expect(b.locator('#net-sos-result')).toContainText('Saved to 1 friend conversations');expect([...store.values()].some(v=>v.text?.startsWith('HERMES SOS'))).toBe(true);await b.getByRole('button',{name:'Close',exact:true}).click();await b.getByRole('button',{name:'Groups',exact:true}).click();
 await b.screenshot({path:'test-results/shared-groups-mobile.png'});expect(errors).toEqual([]);
 console.log('PASS: two isolated browsers connected through a simulated Firestore SDK; unique profiles, request/accept, member add, live chat, shared pins/routes, both location switches, marker removal, leader transfer, invite consent, direct place sharing/import, profile deletion and sketch-icon alignment. This is not a Firestore security-rule or live-service test.');
}catch(e){if(a)await a.screenshot({path:'test-results/social-a-failure.png'});if(b)await b.screenshot({path:'test-results/social-b-failure.png'});console.error(errors);throw e;}finally{await browser.close();}
