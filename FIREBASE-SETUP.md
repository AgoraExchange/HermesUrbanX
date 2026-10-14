# Connect Firebase and deploy HERMES

Project: hermesurbanx. Web-app nickname: HermesUrbenx.

## Firebase console

1. Enable Anonymous Authentication; leave automatic cleanup off.
2. Use the default Standard Cloud Firestore database in locked/production mode. Realtime Database is not needed.
3. Firestore Database → Rules: replace the editor with the entire **updated firestore.rules** from this folder and click **Publish**. The earlier rules only enabled a connection check; the new version enables the shared features. Do not switch to public test mode.
4. Authentication → Settings → Authorized domains: add your GitHub Pages hostname (without scheme or repository path), plus localhost for development.
5. HERMES → Profile → Firebase setup → Test Firebase connection, then **Connect explorer profile** to reserve your username.

The public web configuration is installed. No administrator/service-account key belongs in the website.

## Using shared features

- Groups → Explorers & friends → search an exact username. Send a request; the recipient accepts through Friends or the activity bell.
- Create a solo group. Its leader can add accepted friends, rename the group, share an invite link or revoke links.
- Group links last 24 hours and may be reused until revoked. The recipient explicitly agrees to join. Joining does not make everyone friends or enable location sharing.
- Switch the map to Shared maps, choose the group, and add pins, paths or zones. Members can edit the shared plan. Personal maps and journals stay local.
- To share a position: enable GPS, the master switch in Profile, and the switch in that group's Settings. Both switches are enforced by Firestore rules. Old fixes disappear after 90 seconds.
- Sharing a saved place sends its exact notes/coordinates to a friend's conversation; they can add a copy to their own map.
- SOS sends a fresh location to each accepted friend and reports successful and failed sends. It does not contact emergency services or guarantee notification/read/delivery to a person.
- Deletion releases the name and removes profile/friendships/memberships. The next remaining joiner becomes leader. Shared maps and messages remain. If interrupted, reconnect and retry deletion; the local personal data is cleared after server cleanup succeeds.

Anonymous identity belongs to the browser's Firebase session. Clearing site data or switching browsers/devices can lose access. A username or JSON backup cannot authenticate you. Account recovery/linking is not implemented.

## GitHub Pages and iPhone

Firebase Hosting is unnecessary. Push the HERMES directory contents at the root of a GitHub repository on main. Settings → Pages → GitHub Actions. The workflow installs test dependencies, runs unit tests and emulator security tests, builds dist and deploys it. It does not publish Firebase rules.

Open the hosted HTTPS URL on an iPhone in Safari → Share → Add to Home Screen. Localhost on the computer is not a phone-accessible hosted address. Keep HERMES open for tracking. In-app activity updates are implemented; background/lock-screen push and reliable background GPS are not.

## Acceptance checklist

Before inviting a real crew, run npm run test:rules with Java 21+ and network access to download the emulator. It uses only demo-hermes on loopback; no production data is touched. The restricted development environment could not download the required tools, so this suite is prepared but not locally executed. The GitHub workflow runs it before Pages deployment.

Then test two phones:

1. Reserve different names; verify an already-taken name is rejected.
2. Send/accept a friend request and confirm both lists update.
3. Create a group and exchange messages. Edit a pin and colored path from either device and verify the other updates.
4. Enable GPS and both location switches; confirm the avatar, speed and accuracy. Disable either switch and verify the marker disappears. Leave a group and verify its data is no longer accessible.
5. Open an invite in a third session, join by consent, revoke the link, and verify a new session cannot use it.
6. Share/import a place. Only test SOS with friends who know it is a test.
7. Delete a disposable profile. Verify name release, membership removal, leader transfer and retained group plans.
8. Disconnect/reconnect, deny GPS, let a fix expire, reload the PWA and rotate the phone. Personal notes should work offline; shared writes must not claim success while offline.

Groups support 20 members; chats show the latest 100 messages. Location sharing attempts an update every 15 seconds per group while visible with GPS enabled. Monitor Firebase and Cesium quotas for your usage.

References: https://firebase.google.com/docs/auth/web/anonymous-auth and https://firebase.google.com/docs/firestore/manage-data/transactions
