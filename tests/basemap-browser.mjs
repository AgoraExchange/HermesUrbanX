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
await context.route('https://tile.openstreetmap.org/**',route=>route.abort());
await context.route('https://tiles.openfreemap.org/**',route=>route.request().url().includes('/styles/')?route.fulfill({json:style}):route.fulfill({status:200,contentType:'application/x-protobuf',body:tile}));
await context.route('https://fonts.googleapis.com/**',route=>route.abort());

const errors=[];let page;
try{for(const standalone of [false,true]){page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(value=>Object.defineProperty(navigator,'standalone',{value}),standalone);await page.goto('http://localhost:5188');await expect(page.locator('#launch-splash')).toHaveCount(0);if(await page.locator('#onboard-name').count()){await page.locator('#onboard-name').fill('map_recovery');await page.getByRole('button',{name:'Enter the field'}).click();}await expect(page.locator('#map')).toHaveAttribute('data-basemap','vector',{timeout:20000});await expect(page.locator('#map canvas')).toBeVisible();await expect(page.locator('#map-error')).toBeHidden();await page.getByRole('button',{name:'Drop a pin'}).click();await page.getByRole('button',{name:'Use center',exact:true}).click();await page.locator('#pin-name').fill('Recovery pin');await page.getByRole('button',{name:'Save place',exact:true}).click();await expect(page.locator('.map-pin')).toHaveCount(standalone?2:1);await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(400);await page.setViewportSize({width:440,height:956});await page.screenshot({path:'test-results/basemap-'+standalone+'.png'});await page.getByRole('button',{name:'Map layers',exact:true}).click();await page.getByRole('button',{name:'Use backup street map',exact:true}).click();await expect(page.locator('#map')).toHaveAttribute('data-basemap','vector');await expect(page.locator('#map canvas')).toHaveCount(1);await page.close();}
// A failed vector service presents a retry; a restored service can recover without deleting app data.
page=await context.newPage();await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));await page.route('https://tiles.openfreemap.org/**',r=>r.abort());await page.goto('http://localhost:5188');await expect(page.locator('#map')).toHaveAttribute('data-basemap','unavailable',{timeout:20000});await expect(page.getByRole('button',{name:'Retry map',exact:true})).toBeVisible();await page.unroute('https://tiles.openfreemap.org/**');await page.getByRole('button',{name:'Retry map',exact:true}).click();await expect(page.locator('#map')).toHaveAttribute('data-basemap','vector',{timeout:20000});await expect(page.locator('.map-pin')).toHaveCount(2);expect(errors).toEqual([]);console.log('PASS: raster failure fallback, standalone vector startup, WebGL rendering, retained pins, zoom/resize, repeated layer replacement and network recovery.');
}finally{await browser.close();}
