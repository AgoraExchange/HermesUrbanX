import test from 'node:test';import assert from 'node:assert/strict';import {HermesSocial} from '../social.js';
test('group import resumes a partially saved file without duplicating markings',async()=>{
 const api=new HermesSocial(),store=new Map();let commits=0,fail=true;
 Object.assign(api,{uid:'alice',ready:true,db:{}});api.groups.set('crew',{memberIds:['alice'],direct:false});
 api.sdk={doc:(_, ...p)=>p.join('/'),serverTimestamp:()=>123,runTransaction:async(_,fn)=>{const writes=[];await fn({get:async ref=>({exists:()=>store.has(ref),data:()=>store.get(ref)}),set:(ref,value)=>writes.push([ref,value])});if(++commits===2&&fail)throw Error('Connection interrupted');for(const [k,v] of writes)store.set(k,v);}};
 const bundle={pins:Array.from({length:105},(_,i)=>({id:'p'+i,name:'Point '+i,notes:'Keep',lat:33,lng:-84,type:'meet'})),routes:[]};
 await assert.rejects(()=>api.importMarks('crew',bundle),/interrupted/);assert.equal(store.size,100);fail=false;await api.importMarks('crew',bundle);assert.equal(store.size,105);assert.equal(store.get('groups/crew/marks/p0').authorId,'alice');
 api.groups.set('dm',{memberIds:['alice'],direct:true});await assert.rejects(()=>api.importMarks('dm',bundle),/explore group/);
});
