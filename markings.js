export const DEFAULT_MARKING_COLOR='#d0ec97';
export const markingColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:DEFAULT_MARKING_COLOR;
export const minimumPoints=kind=>kind==='zone'?3:2;
export function validMarkingPoints(points,kind){
  if(!Array.isArray(points)||points.length<minimumPoints(kind))return false;
  if(!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180))return false;
  return new Set(points.map(p=>p.join(','))).size>=minimumPoints(kind);
}
export function buildMarking({id,name,scope,points,color,kind='path',notes='',createdAt=Date.now()}){
  kind=kind==='zone'?'zone':'path';
  if(!String(name).trim())throw Error('Give this marking a name.');
  if(!validMarkingPoints(points,kind))throw Error(`Add at least ${minimumPoints(kind)} different points for this ${kind}.`);
  return {id,name:String(name).trim().slice(0,80),scope,points:points.map(p=>[...p]),color:markingColor(color),kind,notes:String(notes).slice(0,2000),createdAt};
}
