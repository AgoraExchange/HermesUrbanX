import {firebaseConfig} from './firebase-config.js';
const SDK='https://www.gstatic.com/firebasejs/13.0.0/';
let sdkPromise,client,connectionPromise;
export function explainFirebaseError(error){
  const code=error?.code||'';
  if(code.includes('operation-not-allowed')||code.includes('configuration-not-found'))return 'Enable Anonymous in Firebase → Authentication → Sign-in method.';
  if(code.includes('unauthorized-domain'))return 'Add your GitHub Pages hostname to Authentication → Settings → Authorized domains.';
  if(code.includes('permission-denied'))return 'Firestore denied the connection check. Publish the latest supplied Firestore rules, then retry.';
  if(code.includes('invalid-api-key'))return 'Firebase rejected the web API key. Check the registered web-app configuration.';
  if(code.includes('too-many-requests'))return 'Firebase is rate limiting requests. Wait before trying again.';
  if(code.includes('unavailable')||code.includes('network')||error instanceof TypeError)return 'Firebase could not be reached. Check your internet connection and whether Firestore has been created.';
  return 'Firebase setup is not ready. Check Anonymous Authentication, the Firestore database, and its rules.';
}
async function loadSDK(){
  if(!sdkPromise)sdkPromise=Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]).catch(error=>{sdkPromise=null;throw error;});
  return sdkPromise;
}
export async function connectFirebase(){
  const [appSDK,authSDK,dbSDK]=await loadSDK();
  if(!client){const app=appSDK.getApps().find(a=>a.name==='hermes')||appSDK.initializeApp(firebaseConfig,'hermes');client={app,auth:authSDK.getAuth(app),db:dbSDK.getFirestore(app)};}
  await client.auth.authStateReady();
  await authSDK.setPersistence(client.auth,authSDK.browserLocalPersistence);
  if(!client.auth.currentUser)await authSDK.signInAnonymously(client.auth);
  return {...client,sdk:dbSDK,authSDK,uid:client.auth.currentUser.uid};
}
export function testFirebaseConnection(onStep=()=>{}){
  if(!connectionPromise)connectionPromise=runConnectionCheck(onStep).finally(()=>{connectionPromise=null;});
  return connectionPromise;
}
async function runConnectionCheck(onStep){
  onStep('Loading Firebase…');
  const [appSDK,authSDK,dbSDK]=await loadSDK();
  if(!client){const app=appSDK.getApps().find(a=>a.name==='hermes')||appSDK.initializeApp(firebaseConfig,'hermes');client={app,auth:authSDK.getAuth(app),db:dbSDK.getFirestore(app)};}
  onStep('Checking anonymous sign-in…');
  await client.auth.authStateReady();
  await authSDK.setPersistence(client.auth,authSDK.browserLocalPersistence);
  if(!client.auth.currentUser)await authSDK.signInAnonymously(client.auth);
  const user=client.auth.currentUser;
  onStep('Authentication connected. Checking Firestore…');
  // Server-only read of a private path. Missing document is fine; denied/offline is not.
  // No notes, photos, coordinates, or profile fields are uploaded by this check.
  await dbSDK.getDocFromServer(dbSDK.doc(client.db,'connectionChecks',user.uid));
  return {uid:user.uid,projectId:firebaseConfig.projectId};
}
