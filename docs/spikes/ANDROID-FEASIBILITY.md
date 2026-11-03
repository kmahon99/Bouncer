# Android mobile feasibility spike

## Goal

Validate whether a React Native-based Android app can support the MVP's notification, acknowledgement, local perimeter check, and incident-only location needs. This is a time-boxed technical investigation, not production functionality. Keep spike code isolated from `Bouncer.Agent` and `Bouncer.Control`; promote only reviewed, tested parts later.

## MVP assumptions under test

- Android is the first phone platform; the company-device agent remains Windows.
- A phone is the primary device signal for estimating employee presence. Company-device location is secondary evidence and never overrides the phone.
- Every registered employee phone is sent an incident prompt even if location is unavailable.
- The employee can read the incident-only instructions and acknowledge without location permission.
- Before acknowledgement, a phone may compute a local site-perimeter result and send only a derived classification; it must not upload raw coordinates.
- Fine-grained coordinates are reported only after acknowledgement during an active incident, targeting about five seconds when Android permits.
- If reports stop after an initial on-site result, preserve the incident presence state, mark location stale after a measured/configurable freshness window, and request manual follow-up. Never infer off-site or safety from silence.

## Environment discovered

- A bundled Node.js 24.19.0 runtime is available and was used for Expo, TypeScript, Jest, and ESLint commands. The shell's default Node.js 20.19.0 is below the React Native 0.88 engine requirement; Expo's npm subprocesses still emitted engine warnings.
- .NET SDK 10.0.100, Java 26, and Android SDK components are installed. Expo SDK 58 currently selects Android compile SDK 37.
- ADB starts with host access, but `adb devices -l` reported no attached Android device. The only installed emulator system image found was Android R; no usable running AVD was available.
- `expo prebuild --platform android --no-install` generated the native project.
- Native `assembleDebug` reached SDK configuration but failed while the Android SDK manager extracted Platform 37 with `FileAlreadyExistsException` in its temporary unzip directory. No APK was produced; this is an environment/tooling blocker that must be cleared before runtime testing.

## Test protocol

Run the cases on the Android emulator and the user's Android phone. Record exact Android version, device model, app build, permission settings, battery optimization state, network, timestamps, and observed result. Do not treat emulator success as evidence of physical-device reliability.

| Case | Setup/action | Evidence to record | Pass condition |
|---|---|---|---|
| Permission onboarding | Fresh install; allow location; disable/re-enable device location services; revoke app permission in Settings | Permission/service states, app behavior, user explanation | Normal features gate as specified; incident-only route remains accessible |
| Permission denied | Fresh install; deny location permission | Notification and incident-only behavior | Employee can read instructions and acknowledge; no coordinates are created or uploaded |
| Local perimeter check | Set the current location as a synthetic test site, then check current location | Device-side result, accuracy/age, network capture when a backend exists | Only derived in/out/unknown may leave the device before acknowledgement; raw coordinates stay local |
| Prompt foreground | Trigger test incident with app open | Arrival time, display, interaction, acknowledgement | Incident prompt is actionable and acknowledgement is recorded |
| Prompt background/locked | Trigger with app backgrounded and screen locked | Delivery/display time, sound/visibility, unlock requirements | Observed behavior is recorded; no guarantee is inferred from dispatch |
| Process stopped/restarted | Force-stop or terminate according to platform controls, then trigger/reopen | Whether push displays, whether app executes, reconnect state | Failure/limitation is documented and state reconciles safely on reopen |
| Location after acknowledgement | Acknowledge, then walk a known route while app is foregrounded/backgrounded | Timestamps, accuracy, battery, interval distribution | Reports begin only after acknowledgement and stop after incident end; measured limits are recorded |
| Missing later reports | Acknowledge while on-site, then remove location permission, disable services, or cut network | Roster state transition and stale timer | Presence remains on-site evidence; location becomes stale/unavailable and prompts manual follow-up |
| Network interruption | Drop connectivity during prompt, acknowledgement, and location reporting | Queued/retry behavior, timestamps, duplicates | No event is presented as delivered/acknowledged until received; retries are idempotent |

## Implementation approach

- First get an Expo development build installed; Expo Go is not sufficient evidence for native background-location behavior.
- Keep location and notification capability calls behind small typed adapters so React UI and incident rules do not depend directly on Expo APIs.
- Keep test-site coordinates and test accounts synthetic. Do not use real employee data or retain real movement traces.
- A local notification is not equivalent to a remote push. Record which cases use local notification versus an actual push sent through the intended delivery path.
- For any production-intended behavior, use TDD: write deterministic tests for permission-state mapping, incident event handling, freshness/stale transitions, and acknowledgement before implementing that behavior.

## Spike implementation and verification (2026-10-18)

- Added an Expo/React Native app under `bouncer-mobile-spike/` with a readiness/perimeter screen and an incident-only fire acknowledgement screen. Acknowledgement is available without location permission and is stored locally for this spike.
- The local perimeter check calculates distance and uncertainty on-device and displays only `on_site`, `off_site`, or `unknown`. The test-site coordinates are held in memory and no backend or coordinate upload exists.
- After acknowledgement, an Expo background-location task requests Android background permission and asks for updates at a five-second interval. It deliberately discards latitude/longitude and stores only report timestamp, accuracy, and count in local app storage. This tests lifecycle/cadence metadata only; it does not send a report to an admin device or server.
- Added a local notification test scheduled ten seconds ahead. Remote push delivery, app-terminated delivery, incoming-call style presentation, server acknowledgement, map/admin panel, and Windows softlock integration remain unimplemented.
- Android's full-screen-intent permission is designed for extremely high-priority calling/alarm notifications. For apps targeting Android 14+, eligible uses are limited to apps providing calling and alarms; Google Play may revoke the default permission for apps outside that profile. Bouncer must not rely on an incoming-call-style full-screen alert as its normal incident-notification path. Validate high-priority heads-up notifications and a separately reviewed escalation path. See [Android 14 secure full-screen intent changes](https://developer.android.com/about/versions/14/behavior-changes-14#secure-full-screen-intent-notifications) and [Notification.Builder.setFullScreenIntent](https://developer.android.com/reference/android/app/Notification.Builder#setFullScreenIntent(android.app.PendingIntent,boolean)).
- Android background location is subject to OS/vendor behavior; Expo documents that Android background location stops if the app is terminated and does not automatically restart for a location/geofence event. Therefore the five-second interval is a request, not a delivery guarantee. See [Expo Location SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/sdk/location/).
- Verification passed: `tsc --noEmit`; Jest (12 tests); ESLint (direct ESLint CLI under Node 24); `expo config --type public`; and `expo export --platform android` (bundle succeeded).
- Native build attempted: `gradlew -p android assembleDebug`; failed during Android SDK Platform 37 installation with a duplicate file in the SDK manager's temporary extraction directory. No Android runtime cases have passed because no APK/device was available.
- `expo lint` auto-configuration was attempted. It first hit an npm peer conflict (`react-dom` 19.3.1 against React 19.3.0); adding SDK-compatible `react-dom` 19.3.0 resolved package installation. The `expo lint` wrapper then launched the machine's Node 20 and failed on a host filesystem permission error, so the equivalent ESLint CLI was run with bundled Node 24 and passed.
- The generated Expo project reported 53 npm audit findings after lint tooling installation (25 moderate, 28 high). No automatic audit fix was run; assess dependency advisories separately before production use.

## Results log

No device cases have been executed yet. Next actions: repair the Android SDK Platform 37 installation; build and install the development client; run the protocol on an emulator and a physical Android device; implement a real remote-push test path; and measure the available notification presentation without relying on full-screen intent. Record exact Android version, device model, app build, permission settings, battery optimization state, network, timestamps, and observed result. Do not mark BOU-005 Done until the protocol has been run on both emulator and a physical Android device, or each unavailability/limitation has been explicitly accepted by the product owner.
