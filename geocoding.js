import {coordinates} from './core.js';
const cache=new Map();
let lastRequest=0;
export function parsePlaces(json){return (json.features||[]).flatMap(f=>{const [lng,lat]=f.geometry?.coordinates||[];if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return [];const p=f.properties||{};const label=[...new Set([p.name,[p.housenumber,p.street].filter(Boolean).join(' '),p.city||p.town||p.village,p.state,p.postcode,p.country].filter(v=>typeof v==='string'&&v))].join(', ');return [{lat,lng,label:label||`${lat}, ${lng}`}];}).slice(0,5);}
export async function findPlaces(query,{signal,fetcher=fetch}={}){
 query=query.trim();const pair=coordinates(query);if(pair)return [{lat:pair[0],lng:pair[1],label:query}];
 if(/^[\d\s.,+\-]+$/.test(query))throw new Error('Use valid latitude, longitude. Example: 33.749, -84.388');
 if(query.length<3)throw new Error('Enter an address, city, or landmark with at least 3 characters.');
 const key=query.toLowerCase();if(cache.has(key))return cache.get(key);
 if(Date.now()-lastRequest<1000)throw new Error('Please wait a moment before searching again.');lastRequest=Date.now();
 const response=await fetcher(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,{signal,credentials:'omit'});
 if(!response.ok)throw new Error('Address search is unavailable. Try again shortly or enter coordinates.');
 const places=parsePlaces(await response.json());if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(key,places);return places;
}
