# Push notification spike

This is a local development spike, not a production service. The local server has no authentication, keeps data only in memory, and must not be exposed to the public internet.

## Start the local server

From `mobile/`, run:

```powershell
npm.cmd run dev:server
```

The API defaults to port `3000`. Find the laptop's IPv4 address on the same Wi-Fi network (`ipconfig`). On the phone in Bouncer, enter `http://<laptop-ip>:3000` in **Local server address**. The Expo/Metro server uses a different port (currently `8082` for tunnel mode); the Metro tunnel does not tunnel API requests.

If **Send test incident** reports `fetch failed` and the server log says `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, Node is rejecting the laptop's HTTPS certificate chain to Expo. On this laptop, use the bundled Node 22.23 runtime with Windows certificate roots enabled:

```powershell
$nodeDir = 'C:\Users\kmaho\Documents\Codex\2026-10-28\hm\work\bouncer-node-runtime\node\node-v22.23.2-win-x64'
$env:PORT = '3000'
$env:NODE_USE_SYSTEM_CA = '1'
& (Join-Path $nodeDir 'node.exe') '.\dev-server.mjs'
```

## Configure Expo push

Remote push notifications do not work in Expo Go on Android. Use an Expo development build. The app requires an Expo/EAS project ID, and Android remote push requires Firebase Cloud Messaging V1 credentials configured for that EAS project.

Install and link an EAS project once:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

The initialization step adds the EAS project ID to the app configuration. Create or select a Firebase project, register an Android app with package ID `com.bouncer.app`, download its `google-services.json`, and put that file in `mobile/google-services.json`. The app config already points to this file. Expo requires it in the Android build so Firebase can initialize and register the device with FCM.

For sending pushes, generate a Firebase service-account private key from Firebase Project Settings > Service accounts, then upload it to the EAS project with `npx eas-cli@latest credentials --platform android` and select the FCM V1 push credential setup. Do not commit or share that private key. `google-services.json` contains client configuration rather than the service-account private key; Expo allows it in the repo, and the EAS build needs the file.

After adding `google-services.json` and configuring the FCM V1 service-account key, rebuild and install the development APK with:

```powershell
npx eas-cli build --profile development --platform android
```

Install the generated APK on the phone, then start Metro in development-client mode:

```powershell
npx expo start --dev-client --port 8083 --lan
```

Open the installed Bouncer development build (not Expo Go). If automatic discovery is empty or the scanner is unavailable, choose **Enter URL manually** and enter `http://<laptop-ip>:8083` (the Expo development server URL). Both devices need to be on the same Wi-Fi network. The scanner is not needed for this connection.

Once the app opens, the **Local server address** is prefilled from the ignored `.env.local` file. Confirm it is `http://<laptop-ip>:3000`, then press **Enable incident notifications**. On the laptop, open `http://localhost:3000/admin`, enter the assembly point's latitude and longitude (or try the browser location button) and radius, then declare an incident. Opening the Android notification records acknowledgement first, then obtains a one-time foreground location (if permitted) and relays it to the local server. At the assembly point, press **Report safe at assembly point**; the app requests a fresh foreground fix and the server records the report only if the accuracy bounds fit inside the configured area.

The app reports success only after the local server confirms it. Permission denial, stale or uncertain GPS, an outside result, and a network failure leave the employee in follow-up. The manager manifest distinguishes an employee-reported result from **Manager mark safe**. This remains an unauthenticated, in-memory local prototype; use synthetic test data only.

The server exposes `GET /health` and `GET /api/incidents` for local inspection. Incident records and push tokens disappear when the server restarts.

## Open the manager manifest

With the local server running, open `http://<laptop-ip>:3000/admin` in a browser on the laptop. Send a test incident from the phone; the manifest refreshes every five seconds and shows the sample employee roster, acknowledgement, whether a one-time location update was received or requires a manual check, and whether the manager has marked the employee safe. Use **Mark safe** after the manual check.

The dashboard declares an incident by entering a title, response instructions, and assembly point, then **Declare & notify**. It sends an incident push to registered devices. Afterward, **Resolve incident** changes its state and sends a resolution push; the phone clears the active incident view when it receives the resolution while open or when the employee opens the resolution notification. Only one incident can be active at a time. The phone app's test button sends a default Fire drill without an assembly area, so use the dashboard to test **Report safe**.

This demo roster uses placeholder identities (`Employee 001`, etc.). The first registered device is associated with the first unused placeholder. The manifest and safety changes are in memory, and the page has no authentication; use it only on a trusted local network. The prototype location field is stored in the local server memory but is not displayed in the manager page.

The next backend step will replace this local process with a hosted API and persistent database, plus customer and manager authentication. Incidents, roster membership, device delivery, acknowledgements, manager safety checks, and audit timestamps should be persisted there; location should remain incident-scoped and retention-controlled. The spike is not yet ready to hold real employee data.
