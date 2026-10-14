const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Horizontal navigation is independent of look pitch, so inspecting the ground
// cannot steer the pilot into the mesh. Angles are radians, distances are metres.
export function photoFlightStep(p,input,dt,sampleGround=()=>0){
 dt=clamp(dt,0,.05);const {x=0,y=0,height:rise=0,turn=0,look=0,dx=0,dy=0,zoom=0,boost=1}=input;
 const ground=sampleGround(p.longitude,p.latitude);const floor=Number.isFinite(ground)?ground:0;
 const speed=clamp(Math.max(0,p.height-floor)*.3,4,120)*dt*boost;
 const heading=p.heading+turn*.8*dt+dx*.004;let pitch=clamp(p.pitch+look*.65*dt-dy*.004,-1.48,1.48);
 const dolly=clamp(zoom,-2,2)*Math.max(10,p.height-floor)*.6;
 const forward=-y*speed+dolly*Math.cos(pitch),right=x*speed;
 const north=forward*Math.cos(heading)-right*Math.sin(heading),east=forward*Math.sin(heading)+right*Math.cos(heading);
 const latitude=clamp(p.latitude+north/6378137,-Math.PI/2+.00001,Math.PI/2-.00001);
 const longitude=((p.longitude+east/(6378137*Math.max(.00001,Math.cos(latitude)))+3*Math.PI)%(2*Math.PI))-Math.PI;
 let height=p.height+rise*speed+dolly*Math.sin(pitch);
 const next=sampleGround(longitude,latitude),surface=Number.isFinite(next)?next:floor,minimum=surface+2;
 if(height<minimum)height=Math.max(surface+.5,height+(minimum-height)*(1-Math.exp(-dt*10)));
 if(y<0&&height-surface<7&&pitch<-.13&&!look&&!dy)pitch+=(-.12-pitch)*(1-Math.exp(-dt*5));
 return {longitude,latitude,height,heading,pitch};
}
