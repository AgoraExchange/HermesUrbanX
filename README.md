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

## Screen, chats and portable maps

HERMES requests a screen wake lock while visible and reacquires it on returning to the app. Browser support and OS power settings determine whether the request is granted.

Direct friend chats have Open chatbox controls and no shared map or live location stream. Create an explore group for a shared plan. Outgoing messages appear immediately as sending and become sent only after server confirmation. Failed sends preserve the composer text.

The map toolbar button beneath Locate opens Import / export map. Export produces a versioned JSON file for the current map only, including pins, notes, route/zone geometry and colors, without profiles, messages or live locations. Import validates the file and adds its markings to the currently viewed map without removing existing markings. My Map imports remain local; connected group imports save to Firestore and appear for other members. Legacy separate imported maps remain available. Saved Places lists POIs; routes and zones are viewed on the map. Import supports up to 5 MB, 2,000 markings and 500 points per marking.

After this update, publish the latest firestore.rules to enforce the direct-chat map restriction.

## Version 0.3.1 ? map recovery and updates

Installed home-screen apps render street/night maps through OpenFreeMap and MapLibre, preserving Leaflet pins, sketches and interactions. Ordinary browser sessions retain raster tiles with a timed vector fallback when image requests fail. Satellite failures can fall back to an explicitly labeled street map. The map repairs its size on resume and resize, and exposes Retry map plus Reload map / Use backup street map in Map layers. Map imagery requires an available provider and internet connection; the exact reported iPhone failure was not reproduced on physical hardware.

Profile displays HERMES 0.3.1 and Check for updates. Checks fetch uncached version metadata, activate an installed update before reloading, and suppress repeat checks/notices for 15 seconds. Startup shows a 2.5-second splash with progress; slow map downloads continue after it closes. Release metadata in version.json must match APP_VERSION in startup.js.

The bundled MapLibre GL Leaflet adapter is upstream v0.1.3 from https://github.com/maplibre/maplibre-gl-leaflet, with its ISC license in vendor/MAPLIBRE-LEAFLET-LICENSE.txt. OpenFreeMap attribution remains visible on the map.

In 0.3.1, the installed map uses a native MapLibre viewport outside transformed Leaflet panes, synchronizing its camera through public APIs. This covers street, night and satellite. WebKit and Chromium fixtures cover startup, layers, retries and resizing at phone dimensions; physical iPhone confirmation is still required. Group imports report progress in batches and retain document IDs for retries within the same import dialog.

Version 0.3.2 adds App diagnostics in Profile and Map layers. The copyable report includes the first and recent map errors, renderer state and recent in-session notices; review it before sharing. Use basic map bypasses WebGL. Renderer-startup failure followed by image-load failure now reports a persistent error instead of silently stopping recovery. The underlying physical iPhone failure still needs its diagnostic report.

## Version 0.3.3 - restore the original 2D map path

Compared commits 6bf5bcb, 837ab20, 9b8e438, 7930b8a and c8c3ceb. The original Leaflet image renderer and providers were unchanged between the first two commits; 0.3.0 subsequently introduced a standalone-only WebGL default. Version 0.3.3 restores image tiles as the default for every device, retaining vector rendering only as a fallback. It disables tile fade animations and tile blending, explicitly sizes the map, defers layer creation while hidden, and resizes after visible layout settles on tab changes, resume and orientation changes. Existing maps and user data are preserved.

Validation: 36 unit tests; map fallback, startup and sketch browser suites; and the new test:map-lifecycle suite in Chromium and WebKit. The lifecycle suite serves synthetic image tiles from a separate local HTTP origin with a real active service worker and checks screenshot pixels through all layers, hidden/visible tabs, rotation, resume and reload. This verifies visible rendering rather than relying solely on loaded flags. The exact physical iPhone failure has not been independently reproduced; on-device confirmation remains necessary.

## Version 0.3.4 - photorealistic map annotations

Photorealistic 3D receives the current map scope's saved pins, paths and zones. Pins have names above their markers and use heights relative to the 3D surface. Paths retain their colors; zones have closed outlines and translucent fills projected onto 3D Tiles. Markings can be hidden while inspecting imagery. This is a snapshot of the saved map when opening the viewer; reopen to pick up later edits.

The enhancement browser suite checks scope isolation, label text, longitude/latitude ordering, surface-relative placement, path colors, closed zone geometry and show/hide controls using a mocked Cesium boundary; live-provider rendering still requires on-device verification. Cesium API references: https://cesium.com/learn/cesiumjs/ref-doc/PolylineGraphics.html and https://cesium.com/learn/cesiumjs/ref-doc/LabelGraphics.html .
