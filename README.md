# HERMES — connected field companion

A mobile-first PWA with private exploration notes, live group chat, shared maps, and optional foreground location sharing. GitHub Pages serves the site; Firebase provides anonymous identities and Cloud Firestore.

## Try it

Run `npm run build`, then `npm start`, and open http://localhost:5188. Or double-click **Start HERMES.cmd**. The static build uses Node built-ins. `npm ci` installs optional development/test tools.

## Connect your crew

1. Enable Anonymous Authentication, with automatic cleanup **off**, and use the default Standard Firestore database.
2. Copy the entire **updated `firestore.rules`** into Firebase Console → Firestore Database → Rules → **Publish**. The previous connection-check rules are insufficient.
3. HERMES → Profile → **Connect explorer profile**. Reserve a unique username. Your personal notes stay local.
4. Groups → Explorers & friends: search an exact username and send a request. The recipient accepts through the activity bell or Friends screen.
5. Create a solo group, then Settings → Add a friend or Share group invite. Local starter plans can be published using **Publish this plan**.
6. Enable GPS, the master sharing switch in Profile, and sharing for each desired group. Both switches must be enabled. Sharing starts off.

See [FIREBASE-SETUP.md](FIREBASE-SETUP.md) for the phone checklist and deployment details.

## Implemented

- Case-insensitive unique usernames reserved with transactions; server-side seven-day rename cooldown; compressed photos and profile notes.
- Friend requests/acceptance/removal, exact username search, friend links, direct conversations between accepted friends.
- Solo-first groups, leader renaming/friend additions, consented invite joins, 24-hour reusable links and revocation. Maximum 20 members per group. Joining by link does not automatically create friendships.
- Live group chat, latest 100 messages, coordinate/meetup/check-in shortcuts, unread activity badges. Notifications appear **inside the open app**; background push is not implemented.
- Shared pins, notes, colored paths and shaded zones. All group members can edit shared markings. Shared-place messages can be imported into a personal map with their notes.
- Location sharing protected by membership and both privacy switches. Avatars show accuracy, device-reported speed, profile notes and shared groups. Stale fixes disappear after 90 seconds. No location history is stored by HERMES.
- Confirmed SOS to each accepted friend's conversation, reporting successful/failed sends. SOS deliberately shares a fresh position even when continuous sharing is off; it does not contact emergency services or prove someone read it.
- Four-digit deletion confirmation; username release; friendship/membership cleanup; leadership passes to the next remaining member in join order. Group maps/messages remain. Deleted profiles resolve to Deleted explorer.
- Personal maps, journal pagination/prompts, export backup, offline local notes, responsive mobile navigation and PWA shell.
- No-key OpenStreetMap street/night layers, aerial map, free 3D geometry, and keyboard/touch flight controls. The sketch button has a centered route icon and readable mobile label.

## Photorealistic 3D

Map cube → Fly around in 3D → **Photorealistic 3D** starts loading with the configured Cesium token immediately. Fresh device GPS takes priority; without it, the current map view is used. Ground height is sampled where available. Provider coverage and imagery age vary; this does not show verified interiors or current safety conditions.

The public browser token is in `cesium-config.js`. Restrict allowed website URLs and asset access in Cesium ion. Client-side encryption cannot hide a credential sent by the browser. The fallback panel accepts another Cesium token or Google Map Tiles key if necessary. Tokens pasted there are kept only in memory.

## Finding places and flying

Search accepts an address, landmark, or latitude/longitude. Address queries go to the public [Photon service](https://github.com/komoot/photon); results use OpenStreetMap data. Explicit searches only, five results, a small in-memory cache, and no saved address-query history. This community service has no availability guarantee; move to a hosted provider or self-host Photon if usage grows.

Desktop: **WASD** moves, **arrow keys** look, **R/F** changes height, and **Shift** increases speed. Touch: left joystick moves, drag the photorealistic scene with another finger to look, pinch to zoom, and use **+/?** for height. **Fly faster** toggles increased movement speed. Free 3D retains its native map drag/pinch gestures. Desktop mouse devices hide the joystick.

A confirmed group leave immediately clears the group's local subscriptions, map marks and list entry, without reloading the whole app.

## Important boundaries

Anonymous identity belongs to this browser's Firebase session. Clearing site data or switching devices can lose access. A username or JSON backup does not authenticate you; recovery/account linking is not implemented.

Personal maps and journals stay on the device unless explicitly shared. Shared mutations require a connection and wait for server acceptance. Locations update at most every 15 seconds per enabled group while HERMES is visible and GPS is enabled. Browsers/iPhone PWAs cannot guarantee locked-screen or background tracking. Firestore and map-provider quotas apply.

Already viewed or copied data cannot be made undisclosed. Deletion retains group plans and chat history. Empty groups remain stored without a leader. Coordinates are provided directly; reverse-geocoded street names are not implemented, but map details offer an external Maps link.

## Hosting and verification

Use GitHub Pages; Firebase Hosting and Realtime Database are not required. Push this directory as the repository root on main, then Settings → Pages → GitHub Actions. The workflow runs unit and emulator rules tests before building/deploying dist. It does **not** publish Firestore rules.

On iPhone, open the hosted HTTPS address in Safari → Share → Add to Home Screen. The computer's localhost URL is not a hosted phone URL.

Tests: `npm test`, `npm run test:browser`, `npm run test:enhancements`, `npm run test:markings`, `npm run test:social`. Browser tests require the preview server and Chromium; set HERMES_BROWSER to its executable if needed.

Security tests: `npm run test:rules` requires Java 21+ and network access for Firebase's emulator. It targets only the loopback demo-hermes project. The development environment could not download these tools, so the security assertions are **prepared but not locally executed**. The GitHub workflow runs them before deploying Pages.

Multi-user browser tests use a simulated Firestore SDK across isolated sessions. They verify UI/client coordination and do not substitute for the real rules suite or two-phone testing. The live Cesium asset-token check returned HTTP 200; the full live scene was blocked because the development browser could not download Cesium JavaScript. Free WebGL geometry and configured photorealistic startup are tested with fixtures.

Sources: [Firestore transaction/rules validation](https://firebase.google.com/docs/firestore/manage-data/transactions), [anonymous authentication](https://firebase.google.com/docs/auth/web/anonymous-auth), [Cesium scene sampling](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html).
