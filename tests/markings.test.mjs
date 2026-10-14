import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarking,markingColor,validMarkingPoints} from '../markings.js';
const points=[[33,-84],[33.001,-84],[33.001,-84.002]];
test('a zone requires three distinct points and a path requires two',()=>{assert.equal(validMarkingPoints(points.slice(0,2),'path'),true);assert.equal(validMarkingPoints(points.slice(0,2),'zone'),false);assert.equal(validMarkingPoints([points[0],points[0],points[1]],'zone'),false);assert.equal(validMarkingPoints(points,'zone'),true);});
test('saved colored zones retain name, notes and independent geometry',()=>{const mark=buildMarking({id:'a',name:'  Meetup spot  ',scope:'group-1',points,color:'#f58166',kind:'zone',notes:'Wait here.'});assert.equal(mark.name,'Meetup spot');assert.equal(mark.color,'#f58166');assert.equal(mark.scope,'group-1');assert.equal(mark.kind,'zone');mark.points[0][0]=44;assert.equal(points[0][0],33);});
test('malformed coordinates and unsafe colors cannot become saved markings',()=>{assert.throws(()=>buildMarking({name:'Bad',points:[[91,0],[0,0]]}));assert.equal(markingColor('red; background:url(x)'),'#d0ec97');assert.throws(()=>buildMarking({name:' ',points}));});
