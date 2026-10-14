// Use the OS/browser device-location service, never an IP lookup or map center.
export const GPS_OPTIONS = Object.freeze({enableHighAccuracy:true,maximumAge:0,timeout:30000});
export function normalizeFix(position,previous=null,now=Date.now()) {
  const c=position?.coords;
  if(!c||![c.latitude,c.longitude,c.accuracy,position.timestamp].every(Number.isFinite))return null;
  if(Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0||position.timestamp>now+5000||now-position.timestamp>60000)return null;
  if(previous&&position.timestamp<previous.timestamp)return null;
  return {lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,speed:Number.isFinite(c.speed)&&c.speed>=0?c.speed:null,heading:Number.isFinite(c.heading)?c.heading:null,timestamp:position.timestamp};
}
export function accuracyLabel(meters) {
  if(meters<=20)return 'Precise device fix';
  if(meters<=50)return 'Good device fix';
  if(meters<=150)return 'Approximate device fix';
  return 'Low accuracy · refining';
}
export function accuracyZoom(meters){return meters<=20?18:meters<=50?17:meters<=150?16:meters<=500?14:meters<=2000?12:10;}
export class DeviceGPS {
  constructor({geolocation=navigator.geolocation,onFix,onError}) {this.geolocation=geolocation;this.onFix=onFix;this.onError=onError;this.watchId=null;this.generation=0;this.lastFix=null;}
  get running(){return this.watchId!==null;}
  start(){
    this.stop();
    const generation=this.generation;
    this.watchId=this.geolocation.watchPosition(position=>{
      if(generation!==this.generation)return;
      const fix=normalizeFix(position,this.lastFix);
      if(!fix)return;
      this.lastFix=fix;this.onFix(fix);
    },error=>{
      if(generation!==this.generation)return;
      // Timeout and unavailable errors do not terminate a watch: it can refine later.
      if(error.code===1)this.stop();
      this.onError(error);
    },GPS_OPTIONS);
  }
  stop(){this.generation++;if(this.watchId!==null)this.geolocation.clearWatch(this.watchId);this.watchId=null;}
}
