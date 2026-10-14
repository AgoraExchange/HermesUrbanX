import {connectFirebase} from './firebase-client.js';
import {nameKey,millis,safePhoto,encodeMark,decodeMark,membershipAfterLeaving,MAX_MEMBERS,livePosition} from './social-core.js';

// Every shared mutation awaits a server transaction. No silent offline queue of
// location fixes, memberships, usernames or messages is replayed on reconnect.
export class HermesSocial{
  constructor({onChange=()=>{},onError=()=>{}}={}){this.onChange=onChange;this.onError=onError;this.groups=new Map();this.people=new Map();this.friends=[];this.positions=new Map();this.stops=[];this.groupStops=new Map();this.personStops=new Map();this.ready=false;}
  ref(...parts){return this.sdk.doc(this.db,...parts);}
  collection(...parts){return this.sdk.collection(this.db,...parts);}
  stamp(){return this.sdk.serverTimestamp();}
  assertOnline(){if(globalThis.navigator?.onLine===false)throw Error('You are offline. Shared changes need a connection; your personal notes still work.');if(!this.ready)throw Error('Connect your explorer profile first.');}
  async connect(local){
    Object.assign(this,await connectFirebase());
    const profileRef=this.ref('profiles',this.uid),key=nameKey(local.username);
    const profile=await this.sdk.runTransaction(this.db,async tx=>{
      const existing=await tx.get(profileRef);if(existing.exists())return existing.data();
      const reserved=await tx.get(this.ref('usernames',key));if(reserved.exists())throw Error('That username is already taken. Choose another username to connect.');
      const p={username:key,note:local.note||'',photo:safePhoto(local.photo),shareLocation:false,status:'active',createdAt:this.stamp(),renamedAt:this.stamp()};
      tx.set(this.ref('usernames',key),{uid:this.uid});tx.set(profileRef,p);return p;
    });
    this.profile=profile;this.ready=true;this.start();return {id:this.uid,...profile,createdAt:millis(profile.createdAt)||Date.now(),renamedAt:millis(profile.renamedAt)||Date.now()};
  }
  listen(ref,next,bag=this.stops){const stop=this.sdk.onSnapshot(ref,{includeMetadataChanges:true},s=>{this.offline=!!s.metadata?.fromCache;next(s);this.onChange();},e=>this.onError(e));bag.push(stop);return stop;}
  start(){
    this.listen(this.ref('profiles',this.uid),s=>{this.profile=s.exists()?s.data():null;this.people.set(this.uid,this.profile);});
    this.listen(this.sdk.query(this.collection('friends'),this.sdk.where('members','array-contains',this.uid)),s=>{this.friends=s.docs.map(d=>({id:d.id,...d.data()}));for(const f of this.friends)this.watchPerson(f.members.find(id=>id!==this.uid));});
    this.listen(this.sdk.query(this.collection('groups'),this.sdk.where('memberIds','array-contains',this.uid)),s=>{
      const ids=new Set(s.docs.map(d=>d.id));for(const [id,stops] of this.groupStops)if(!ids.has(id)){stops.forEach(f=>f());this.groupStops.delete(id);this.groups.delete(id);for(const key of this.positions.keys())if(key.startsWith(id+'/'))this.positions.delete(key);}
      for(const d of s.docs){const old=this.groups.get(d.id),g={...old,id:d.id,...d.data(),messages:old?.messages||[],marks:old?.marks||[],prefs:old?.prefs||new Map()};this.groups.set(d.id,g);g.memberIds.forEach(id=>this.watchPerson(id));if(!old)this.watchGroup(g);}
    });
  }
  watchPerson(id){if(!id||this.personStops.has(id))return;const bag=[];this.personStops.set(id,bag);this.listen(this.ref('profiles',id),s=>{this.people.set(id,s.exists()?s.data():null);},bag);}
  watchGroup(g){
    const bag=[];this.groupStops.set(g.id,bag);
    this.listen(this.sdk.query(this.collection('groups',g.id,'messages'),this.sdk.orderBy('createdAt','desc'),this.sdk.limit(100)),s=>{const live=this.groups.get(g.id);if(live)live.messages=s.docs.map(d=>({id:d.id,...d.data(),pending:d.metadata.hasPendingWrites})).reverse();},bag);
    this.listen(this.collection('groups',g.id,'marks'),s=>{const live=this.groups.get(g.id);if(live)live.marks=s.docs.map(d=>decodeMark(d.id,g.id,d.data())).filter(Boolean);},bag);
    this.listen(this.collection('groups',g.id,'preferences'),s=>{const live=this.groups.get(g.id);if(live)live.prefs=new Map(s.docs.map(d=>[d.id,d.data()]));},bag);
  }
  // Subscribe to individual locations only when both privacy switches permit it.
  refreshPresence(){
    this.presenceStops??=new Map();this.presenceRetry??=new Map();const desired=new Set();
    for(const g of this.groups.values())for(const id of g.memberIds){const key=g.id+'/'+id;if(id===this.uid||!this.people.get(id)?.shareLocation||!g.prefs.get(id)?.shareLocation)continue;desired.add(key);if(this.presenceStops.has(key)||(this.presenceRetry.get(key)||0)>Date.now())continue;const stop=this.sdk.onSnapshot(this.ref('groups',g.id,'locations',id),s=>{if(s.exists())this.positions.set(key,{...s.data(),uid:id,groupId:g.id});else this.positions.delete(key);this.onChange();},()=>{this.positions.delete(key);this.presenceStops.delete(key);this.presenceRetry.set(key,Date.now()+15000);this.onChange();});this.presenceStops.set(key,stop);}
    for(const [key,stop] of this.presenceStops)if(!desired.has(key)){stop();this.presenceStops.delete(key);this.positions.delete(key);}
  }
  async updateProfile(values){
    this.assertOnline();const username=nameKey(values.username);
    await this.sdk.runTransaction(this.db,async tx=>{
      const ref=this.ref('profiles',this.uid),snapshot=await tx.get(ref),old=snapshot.data();if(!old)throw Error('Profile no longer exists.');
      const next={username,note:String(values.note||'').slice(0,180),photo:safePhoto(values.photo),shareLocation:!!values.shareLocation};
      if(username!==old.username){if(Date.now()-millis(old.renamedAt)<7*86400000)throw Error('You can change your username every 7 days.');const target=this.ref('usernames',username);if((await tx.get(target)).exists())throw Error('That username is already taken.');tx.delete(this.ref('usernames',old.username));tx.set(target,{uid:this.uid});next.renamedAt=this.stamp();}
      tx.update(ref,next);
    });
    if(!values.shareLocation)await this.clearLocations();
  }
  async search(username){this.assertOnline();const snap=await this.sdk.getDocFromServer(this.ref('usernames',nameKey(username)));if(!snap.exists())return null;const id=snap.data().uid,p=await this.sdk.getDocFromServer(this.ref('profiles',id));return p.exists()&&p.data().status==='active'?{id,...p.data()}:null;}
  edge(other){return this.friends.find(f=>f.members.includes(other));}
  async requestFriend(other){
    this.assertOnline();if(other===this.uid)throw Error('That is your own profile.');const ref=this.ref('friends',this.uid+'~'+other),reverse=this.ref('friends',other+'~'+this.uid);
    await this.sdk.runTransaction(this.db,async tx=>{const [a,b]=await Promise.all([tx.get(ref),tx.get(reverse)]);if(a.exists()||b.exists())throw Error('A friendship or request already exists. Check your activity.');tx.set(ref,{members:[this.uid,other],from:this.uid,to:other,status:'pending',createdAt:this.stamp()});});
  }
  async answerFriend(id,accept){this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('friends',id),s=await tx.get(ref);if(!s.exists())return;if(accept)tx.update(ref,{status:'accepted'});else tx.delete(ref);});}
  async createGroup(name){this.assertOnline();const ref=this.sdk.doc(this.collection('groups'));await this.sdk.runTransaction(this.db,async tx=>{tx.set(ref,{name:name.trim().slice(0,60),memberIds:[this.uid],leaderId:this.uid,createdAt:this.stamp(),updatedAt:this.stamp(),addedId:this.uid,joinToken:'',direct:false});});return ref.id;}
  async settings(id,name,sharing){
    this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('groups',id),s=await tx.get(ref);if(!s.exists())throw Error('Group no longer exists.');if(s.data().leaderId===this.uid)tx.update(ref,{name:name.trim().slice(0,60),updatedAt:this.stamp()});tx.set(this.ref('groups',id,'preferences',this.uid),{shareLocation:!!sharing});if(!sharing)tx.delete(this.ref('groups',id,'locations',this.uid));});
  }
  async addMember(id,other){this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('groups',id),s=await tx.get(ref),g=s.data();if(g.memberIds.includes(other))return;if(g.memberIds.length>=MAX_MEMBERS)throw Error('This group has reached 20 members.');tx.update(ref,{memberIds:[...g.memberIds,other],addedId:other,joinToken:'',direct:false,updatedAt:this.stamp()});});}
  forgetGroup(id){
    (this.groupStops.get(id)||[]).forEach(stop=>stop());this.groupStops.delete(id);this.groups.delete(id);
    for(const [key,stop] of this.presenceStops||[])if(key.startsWith(id+'/')){stop();this.presenceStops.delete(key);}
    for(const key of this.positions.keys())if(key.startsWith(id+'/'))this.positions.delete(key);
  }
  async leave(id){this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('groups',id),s=await tx.get(ref);if(!s.exists()||!s.data().memberIds.includes(this.uid))return;tx.update(ref,{...membershipAfterLeaving(s.data().memberIds,this.uid),updatedAt:this.stamp()});tx.delete(this.ref('groups',id,'locations',this.uid));tx.delete(this.ref('groups',id,'preferences',this.uid));});this.forgetGroup(id);this.onChange();}
  async makeInvite(id){this.assertOnline();const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');await this.sdk.runTransaction(this.db,async tx=>{tx.set(this.ref('invites',token),{groupId:id,ownerId:this.uid,name:this.groups.get(id).name,createdAt:this.stamp(),expiresAt:this.sdk.Timestamp.fromMillis(Date.now()+86400000)});});return token;}
  async inspectInvite(token){this.assertOnline();const s=await this.sdk.getDocFromServer(this.ref('invites',token));if(!s.exists()||millis(s.data().expiresAt)<Date.now())throw Error('This invite expired or was revoked. Ask the leader for a new link.');return s.data();}
  async join(token){
    const invite=await this.inspectInvite(token),id=invite.groupId;
    if(this.groups.has(id))return id;
    await this.sdk.runTransaction(this.db,async tx=>tx.set(this.ref('groups',id,'admissions',this.uid),{token}));
    await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('groups',id),s=await tx.get(ref),g=s.data();if(g.memberIds.includes(this.uid))return;if(g.memberIds.length>=MAX_MEMBERS)throw Error('This group has reached 20 members.');tx.update(ref,{memberIds:[...g.memberIds,this.uid],addedId:this.uid,joinToken:token,direct:false,updatedAt:this.stamp()});});
    await this.waitForGroup(id);return id;
  }
  async send(id,text,pin=null,messageId=null){
    this.assertOnline();const ref=messageId?this.ref('groups',id,'messages',messageId):this.sdk.doc(this.collection('groups',id,'messages'));const attachment=pin?JSON.stringify(encodeMark(pin,'pin')):'';
    await this.sdk.runTransaction(this.db,async tx=>{if(messageId&&(await tx.get(ref)).exists())return;tx.set(ref,{authorId:this.uid,text:String(text).slice(0,2000),attachment,createdAt:this.stamp()});});return ref.id;
  }
  async direct(other){
    this.assertOnline();if(this.edge(other)?.status!=='accepted')throw Error('Accept a friend request before messaging.');
    const id='dm_'+[this.uid,other].sort().join('_'),ref=this.ref('groups',id);
    // A direct group has the same controls as other groups; the first sender leads it.
    await this.sdk.runTransaction(this.db,async tx=>{const s=await tx.get(ref);if(s.exists()){if(!s.data().memberIds.includes(this.uid))throw Error('You left this conversation. Start a new explore group.');return;}tx.set(ref,{name:'@'+(this.profile?.username||'Explorer')+' + @'+(this.people.get(other)?.username||'Explorer'),memberIds:[this.uid,other],leaderId:this.uid,createdAt:this.stamp(),updatedAt:this.stamp(),addedId:other,joinToken:'',direct:true});});await this.waitForGroup(id);return id;
  }
  async waitForGroup(id){for(let i=0;i<40;i++){if(this.groups.has(id))return;await new Promise(resolve=>setTimeout(resolve,100));}}
  async saveMark(gid,id,mark,kind){this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('groups',gid,'marks',id),s=await tx.get(ref);tx.set(ref,{...encodeMark(mark,kind),authorId:s.exists()?s.data().authorId:this.uid,createdAt:s.exists()?s.data().createdAt:this.stamp(),updatedAt:this.stamp()});});}
  async deleteMark(gid,id){this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>tx.delete(this.ref('groups',gid,'marks',id)));}
  async clearLocations(){for(const g of this.groups.values())await this.sdk.runTransaction(this.db,async tx=>tx.delete(this.ref('groups',g.id,'locations',this.uid)));}
  async publishLocation(fix){
    if(!this.ready||!this.profile?.shareLocation||this.profile.status!=='active'||!livePosition({...fix,measuredAt:fix?.timestamp})||globalThis.document?.hidden||globalThis.navigator?.onLine===false)return;
    for(const g of this.groups.values())if(g.prefs.get(this.uid)?.shareLocation){await this.sdk.runTransaction(this.db,async tx=>{tx.set(this.ref('groups',g.id,'locations',this.uid),{lat:fix.lat,lng:fix.lng,accuracy:fix.accuracy,speed:Number.isFinite(fix.speed)?Math.max(0,fix.speed):null,measuredAt:fix.timestamp,updatedAt:this.stamp()});});}
  }
  async deleteProfile(){
    this.assertOnline();await this.sdk.runTransaction(this.db,async tx=>tx.update(this.ref('profiles',this.uid),{status:'deleting',shareLocation:false}));
    // Retryable cleanup: discover the server memberships, not only cached listeners.
    const groups=await this.sdk.getDocsFromServer(this.sdk.query(this.collection('groups'),this.sdk.where('memberIds','array-contains',this.uid)));for(const g of groups.docs)await this.leave(g.id);
    const friends=await this.sdk.getDocsFromServer(this.sdk.query(this.collection('friends'),this.sdk.where('members','array-contains',this.uid)));for(const f of friends.docs)await this.answerFriend(f.id,false);
    const invites=await this.sdk.getDocsFromServer(this.sdk.query(this.collection('invites'),this.sdk.where('ownerId','==',this.uid)));for(const i of invites.docs)await this.sdk.runTransaction(this.db,async tx=>tx.delete(i.ref));
    await this.sdk.runTransaction(this.db,async tx=>{const ref=this.ref('profiles',this.uid),p=await tx.get(ref);if(p.exists()){tx.delete(this.ref('usernames',p.data().username));tx.delete(ref);}});
    this.dispose();try{await this.authSDK.deleteUser(this.auth.currentUser);}catch{await this.authSDK.signOut(this.auth);}
  }
  dispose(){this.ready=false;this.stops.forEach(f=>f());this.groupStops.forEach(b=>b.forEach(f=>f()));this.personStops.forEach(b=>b.forEach(f=>f()));this.presenceStops?.forEach(f=>f());this.stops=[];this.groups.clear();this.positions.clear();}
}
