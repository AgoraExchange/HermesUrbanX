import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:process.env.HERMES_BROWSER||path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
// Synthetic vector tile for rendering verification, not real imagery or live data.
const v=n=>{const out=[];do{let byte=n&127;n>>>=7;if(n)byte|=128;out.push(byte);}while(n);return out;};
const bytes=(tag,body)=>[...v(tag*8+2),...v(body.length),...body];
const number=(tag,n)=>[...v(tag*8),...v(n)];const string=(tag,s)=>bytes(tag,[...Buffer.from(s)]);
const geometry=[9,3000,3000,26,2000,0,0,2000,1999,0,15];
const feature=[...number(1,1),...bytes(2,[0,0]),...number(3,3),...bytes(4,geometry.flatMap(v))];
const tile=Buffer.from(bytes(3,[...number(15,2),...string(1,'building'),...bytes(2,feature),...string(3,'render_height'),...bytes(4,number(4,28)),...number(5,4096)]));
const style={version:8,sources:{openmaptiles:{type:'vector',tiles:['https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf'],maxzoom:14}},layers:[{id:'background',type:'background',paint:{'background-color':'#17261f'}},{id:'building',type:'fill',source:'openmaptiles','source-layer':'building',paint:{'fill-color':'#76956d'}}]};
await context.route('https://tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',path:'assets/icon-192.png'}));
await context.route('https://tiles.openfreemap.org/**',route=>route.request().url().includes('/styles/')?route.fulfill({json:style}):route.fulfill({status:200,contentType:'application/x-protobuf',body:tile}));
await context.route('https://fonts.googleapis.com/**',route=>route.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{let ok,bad;window.deliverFix=(accuracy,offset=0)=>ok({timestamp:Date.now()+offset,coords:{latitude:33.749,longitude:-84.388,accuracy,speed:null,heading:null}});window.gpsError=code=>bad({code});Object.defineProperty(navigator,'geolocation',{value:{watchPosition:(success,error,opts)=>{window.gpsOpts=opts;ok=success;bad=error;return 1;},clearWatch:()=>{}}});});
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://localhost:5188',{waitUntil:'domcontentloaded'});await page.locator('#onboard-name').fill('flight_test');await page.getByRole('button',{name:'Enter the field'}).click();
  expect(await page.locator('#map').evaluate(el=>el.classList.contains('night-map'))).toBe(true);expect(await page.locator('.leaflet-tile').first().getAttribute('src')).toMatch(/^https:\/\/tile\.openstreetmap\.org\//);
  await page.getByRole('button',{name:'Enable GPS',exact:true}).click();await page.evaluate(()=>window.deliverFix(1200));await expect(page.locator('#gps-detail')).toContainText('1200 m');await expect(page.locator('#gps-button')).toHaveText('Refine GPS');expect(await page.evaluate(()=>window.gpsOpts)).toEqual({enableHighAccuracy:true,maximumAge:0,timeout:30000});
  await page.evaluate(()=>window.gpsError(3));await expect(page.locator('#gps-title')).toContainText('Waiting');await page.evaluate(()=>window.deliverFix(6));await expect(page.locator('#gps-detail')).toContainText('±6 m');await expect(page.locator('#gps-title')).toContainText('Following');
  await page.evaluate(()=>window.deliverFix(500,-61000));await expect(page.locator('#gps-detail')).toContainText('±6 m');
  await page.getByRole('button',{name:'Explore this area'}).click();await page.getByRole('button',{name:'Fly around in 3D'}).click();await expect(page.locator('.fly-dialog')).toBeVisible();await expect(page.locator('#fly-status')).toBeHidden({timeout:20000});await expect(page.locator('#fly-canvas canvas')).toBeVisible();
  const before=await page.locator('#fly-readout').textContent();await page.locator('#fly-canvas canvas').click({position:{x:100,y:100}});await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');await expect(page.locator('#fly-readout')).not.toHaveText(before);
  const after=await page.locator('#fly-readout').textContent();await expect(page.locator('.flight-joystick')).toBeHidden();await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');
  await page.screenshot({path:'test-results/3d-fixture-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/3d-fixture-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(()=>{window.photoLoads=[];window.Cesium={Ion:{defaultAccessToken:''},Math:{toRadians:n=>n*Math.PI/180,toDegrees:n=>n*180/Math.PI},Cartesian3:{fromDegrees:(lng,lat,height)=>({lng,lat,height})},Cartographic:{fromDegrees:(lng,lat)=>({longitude:lng,latitude:lat})},Color:{fromCssColorString:s=>s},Viewer:class{constructor(node){this.node=node;this.node.innerHTML='<canvas></canvas>';this.camera={positionCartographic:{latitude:0,longitude:0,height:0},setView:({destination:d})=>{window.photoView=d;this.camera.positionCartographic={latitude:d.lat*Math.PI/180,longitude:d.lng*Math.PI/180,height:d.height};}};this.scene={primitives:{add:()=>{}},sampleHeightSupported:true,sampleHeightMostDetailed:async()=>[{height:330}]};this.entities={add:()=>{}};}destroy(){this.node.innerHTML='';}},createGooglePhotorealistic3DTileset:async()=>{window.photoLoads.push(window.Cesium.Ion.defaultAccessToken);return {destroy:()=>{},tileFailed:{addEventListener:()=>{}}};}};});await page.getByRole('button',{name:'Photorealistic 3D',exact:true}).click();await expect(page.locator('#fly-status')).toBeHidden();await expect(page.locator('#fly-key-form')).toBeHidden();expect(await page.evaluate(async()=>window.photoLoads[0]===(await import('./cesium-config.js')).cesiumIonToken)).toBe(true);expect(await page.evaluate(()=>window.photoView)).toEqual({lng:-84.388,lat:33.746,height:780});await page.getByRole('button',{name:'Back to map'}).click();await expect(page.locator('.fly-dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Firebase setup',exact:true}).click();await expect(page.locator('#sheet')).toContainText('hermesurbanx');
  // Simulate real SDK boundaries to verify integration sequencing, not remote project readiness.
  await context.route('https://www.gstatic.com/firebasejs/13.0.0/*',async route=>{
    const url=route.request().url();let script;
    if(url.endsWith('firebase-app.js'))script='export const getApps=()=>[];export const initializeApp=(config,name)=>({config,name});';
    if(url.endsWith('firebase-auth.js'))script='const auth={currentUser:null,authStateReady:async()=>{}};export const getAuth=()=>auth;export const browserLocalPersistence={};export const setPersistence=async()=>{};export const signInAnonymously=async()=>{auth.currentUser={uid:"test-anonymous-user"}};';
    if(url.endsWith('firebase-firestore.js'))script='export const getFirestore=()=>({});export const doc=(_db,path,id)=>({path,id});export const getDocFromServer=async(ref)=>{if(ref.path!=="connectionChecks"||ref.id!=="test-anonymous-user")throw Error("Wrong probe");return {exists:()=>false};};';
    await route.fulfill({status:200,contentType:'text/javascript',body:script||'',headers:{'access-control-allow-origin':'*'}});
  });
  await page.getByRole('button',{name:'Test Firebase connection'}).click();await expect(page.locator('#firebase-status')).toContainText('server access passed');expect(errors).toEqual([]);
  console.log('PASS: no-key map URLs, fresh device GPS, transient error recovery, stale sample rejection, real WebGL 3D rendering with synthetic vector fixtures, flight controls, mobile layout, configured Cesium token, GPS-centered photorealistic startup and sampled ground height (Cesium mocked), Firebase SDK sequence (mocked). Live provider access is not verified.');
}catch(error){await page.screenshot({path:'test-results/enhancements-failure.png'});console.error(errors);throw error;}finally{await browser.close();}
