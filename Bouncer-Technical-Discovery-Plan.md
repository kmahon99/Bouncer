# Bouncer — Technical Discovery and Implementation Plan

**Status:** Active discovery and implementation status; updated 3 November 2026
**Version:** 0.1
**Original date:** 30 October 2026
**Purpose:** Resolve technical risks and define a first implementation slice for Bouncer's software-only MVP.

## 1. Product decisions to carry forward

- Product: Bouncer, a SaaS service for workplace incidents, initially evacuations and fire drills.
- Clients: Android 13+ employee app, Windows 10 work-device app, and a customer web portal. The target is the initial Windows 10 release if technically feasible.
- Customers manage multiple workplaces, employees, roles, protocols, rectangular map perimeters, retention settings, and later billing. Billing is out of the pilot; Stripe is the anticipated later provider.
- The active incident roster is all active employees associated with the incident workplace. One active incident per workplace is enough for the MVP.
- Opening an incident notification launches the matching phone-app incident, automatically acknowledges it, and displays the protocol and assembly-point instructions.
- Preserve separate state for device delivery, employee response, location permission/availability, last perimeter observation/freshness, manager-entered safety, and critical-device popup seen status. A location denial must not block incident acknowledgement; do not overload **Denied access**, **Manual check**, or **Unreachable** to represent multiple dimensions.
- Managers can select an employee in **Manual check** and mark them **Safe** after an offline check. Record manager and time. Neither acknowledgement nor GPS presence proves safety.
- Every registered employee phone is prompted regardless of a location result. Employees can view incident instructions and acknowledge without location permission. Fine-grained reporting starts only after acknowledgement during an active incident, targets approximately five-second intervals where Android permits, exposes freshness/accuracy, and stops at incident end. Do not present the interval as guaranteed; validate foreground and background behavior on supported devices.
- Work devices receive an incident state and use either a persistent full overlay or a bottom-right critical-device popup with a cancel button. Canceling the popup records **Seen**; it does not resolve the incident.
- The cloud service should retry unacknowledged device broadcasts every five seconds while the incident is active. Investigate whether this is appropriate for Android push; distinguish provider acceptance, device receipt, notification display, employee opening/acknowledgement, and work-device receipt.
- Initial delivery aspiration: within one minute when a device is reachable. This is an engineering target, not a guaranteed service promise.
- Use a third-party identity/profile and session-management provider, selected during technical discovery. Pilot employee identity uses name and work email.
- Customer admins set incident-record retention based on company policy and applicable regional data-protection requirements. Automatic HR/API employee removal is deferred.

## Current repository and discovery status (3 November 2026)

The repository is no longer an empty planning workspace. It contains `Bouncer.Agent` (Avalonia/.NET 8), `Bouncer.Control` (ASP.NET Core/.NET 10 with a prototype SignalR hub and `/lock` endpoint), a tracked Expo app under `mobile/` with a local in-memory push-test server and manager page, and `supabase/` with an initial migration/configuration/synthetic seed. A partial Android feasibility spike is tracked under `bouncer-mobile-spike/`; its fuller Expo Router UI is being tested separately at `D:\bouncer-mobile-spike` and has not yet been integrated as the canonical app. See [Android feasibility](docs/spikes/ANDROID-FEASIBILITY.md), [backend discovery](Bouncer-Backend-Discovery.md), and [mobile push testing](mobile/PUSH-TESTING.md).

None of these pieces is production-ready. The mobile local server is unauthenticated and ephemeral. Supabase has no hosted project, authenticated mutation functions, notification worker, or reviewed RLS test suite. The ASP.NET `/lock` and SignalR paths are prototype-only and must not be exposed to real users. A development APK was installed on the user's Android device, but QR scanner/app launch problems prevented successful scenario validation; the latest Release build is still blocked.

Supabase is the current recommended pilot evaluation path, not a hosted deployment decision. The boundary between Supabase functions and the existing ASP.NET service—especially for authenticated Windows-agent commands—still needs an explicit architecture decision. Do not connect both prototypes as competing sources of incident state.

## 2. Early technical findings

The tracked `mobile/` project contains a local push/acknowledgement/manifest/resolve test path and setup guide. Its runtime behavior is not yet documented against the required Android device matrix. Hosted backend discovery recommends Supabase (Postgres, Auth, and server-side Edge Functions) for pilot evaluation; this is not a production deployment decision. See [Bouncer-Backend-Discovery.md](Bouncer-Backend-Discovery.md) for current implementation state and outstanding region/auth/retention questions.

### Android urgent notifications

Firebase Cloud Messaging (FCM) high-priority messages are intended for time-sensitive, user-visible content. FCM attempts immediate delivery and can wake a sleeping device in Doze, but the documentation describes an attempt, not a one-minute delivery guarantee. FCM may deprioritize high-priority messages if they do not produce visible notifications. If Android 13 notification permission is denied, the app cannot post ordinary notifications.

FCM's message-send response means that FCM accepted the message, not that the handset received or showed it. Delivery telemetry is therefore a separate event from employee acknowledgement. Notification delegation/proxying can also change which client callbacks and analytics are observed, so device-delivery semantics need a prototype.

Bouncer should send a visible incident notification directly in the FCM payload and render it immediately, without a network fetch before display. The notification tap should deep-link into the incident; the app records employee acknowledgement once the authenticated app handles that tap and reaches the service.

Incident.io's public changelog confirms that it sends incident-related push notifications and has offered Android users an opt-in alarm-style high-priority notification. This is evidence that a polished incident-alert experience is possible, but its public material does not disclose its server/client implementation or guarantee delivery timing. Google Play restricts default full-screen-intent eligibility for Android 14+ apps to calling and alarm apps. Bouncer should not depend on full-screen-intent eligibility without a separate policy and platform review. Investigate high-priority heads-up notifications, sound/vibration, notification channels, and user-configurable alert settings as the baseline.

### Five-second Android location checks

Fine-grained location begins only after the employee acknowledges and grants the required location permission, and only while the incident is active. The current product target is intermittent reports at roughly five-second intervals when the OS, app lifecycle, device, battery, and network permit. Foreground and background behavior must be tested separately; the app may lose updates when backgrounded or terminated. Report the last observation time/accuracy and make it stale when the freshness window expires. Do not interpret silence as departure or safety, collect location outside an active incident, or retain/display a continuous movement trail.

### Delivery retry cadence

The existing product decision says to retry device broadcasts every five seconds until the device acknowledges receipt or the incident resolves. This must be tested against FCM high-priority quota/deprioritization behavior and user experience. Sending a new visible high-priority notification every five seconds could create notification spam and risk priority deprioritization. Prototype alternatives include one FCM alert followed by a controlled retry policy, with retry events updating the same notification identifier, while a work device maintains its own persistent incident state/heartbeat.

Do not treat a server-to-FCM success response as delivery. Define per target device: **Queued**, **Provider accepted**, **Device receipt reported** (where observable), **Notification opened / employee acknowledged**, **Unreachable**, and **Resolved/cancelled**. Represent notification permission and location permission separately from delivery and response. Keep user-facing and audit labels understandable and avoid promising more delivery certainty than the platform reports.

## 3. Discovery questions and outputs

### A. Android notification spike

**Questions**

- Which FCM payload form gives the most reliable visible alert when the app is idle, Dozing, force-stopped, or recently unused?
- What can Bouncer reliably observe for provider acceptance, device receipt, display, tap, and server acknowledgement, including when FCM delegates notification display?
- What happens when notification permission is denied, app notifications or a notification channel are disabled, the phone is offline, or battery restrictions apply?
- Does a five-second retry deliver meaningful reliability, or does it cause notification spam/deprioritization? Can retries update/collapse the same incident notification?
- What alert sound/vibration/channel configuration is appropriate, and what controls remain with the employee?
- Can the incident tap deep-link and acknowledge safely if authentication has expired or the network is unavailable?

**Output**

A small Android proof of concept and a delivery state table. Run a test matrix on the user's Android 13 device: foreground, background, screen off/Doze, notifications allowed/denied, channel muted, app recently used/not recently used, and network disconnected/reconnected. Record median and worst observed timings, but label the sample as a test rather than a guarantee.

### B. Android location spike

**Questions**

- Can the immediate foreground location read be reliably relayed with the notification-open acknowledgement?
- What stale threshold should apply after the app leaves the foreground or location access is unavailable?
- What permission flow is required on Android 13+? What happens when precise permission is denied or location services are disabled?
- What freshness threshold separates **Within/Outside workplace perimeter** from **Manual check** or stale/unknown?
- What battery cost and location accuracy are observed indoors and near a rectangular boundary?

**Output**

A location proof of concept and an explicit state-transition table. Test visible and background use, screen locked, precise/approximate or denied permission, location switched off, weak indoor GPS, and boundary drift. Preserve the five-second desired interval only for modes that actually support it; always display observation time/freshness.

### C. Windows work-device and backend delivery

- The Avalonia agent and ASP.NET Core control prototype are now present in the repository. Inspect them as prototypes; their current overlay, hub, and `/lock` route do not provide production authentication, tenant isolation, delivery guarantees, robust enforcement, or recovery.
- Validate Windows 10/11 support, .NET/Avalonia lifecycle, device provisioning, TLS, overlay behavior, and recovery before defining supported customer devices.
- Define an authenticated and site-scoped agent command/event contract, including delivery receipt, reconnect/heartbeat, idempotency, stale commands, incident resolution, and support recovery. Do not wire the agent to the current unauthenticated broadcast.
- Decide whether the ASP.NET service remains the device gateway, is replaced by a Supabase-backed service, or is retired. Keep a single source of truth for incident state and audit events.
- Test process restart, network loss, duplicate/out-of-order events, reboot, and service restart during an active incident.

### D. Identity, data, and service boundaries

- Compare third-party identity providers for Android, Windows, and web support; organization/user roles; email login; session revocation; MFA options; audit/security features; pricing; and data residency.
- Keep authentication identity separate from Bouncer's employee/workplace membership records. Name and work email are the pilot identity attributes; customer roles and multi-workplace membership remain Bouncer domain data.
- Model customer, workplace rectangle, employee, workplace membership, role, incident type, versioned protocol, work device, incident, device delivery event, employee response event, location observation, manual safety outcome, and audit/retention policy.
- Use append-only incident events or an equivalent audit-safe model for declaration, delivery, acknowledgement, location observation, Safe, Seen, and resolution. Derive current manifest state from the events, while allowing the database to maintain a query-friendly current projection.
- Define retention by region and data category, including location observations, audit records, backups, and deletion evidence. Avoid promising indefinite retention; expose customer-configured policy subject to applicable law.
- Keep billing behind a later integration boundary. Stripe is the anticipated provider, but billing is not required for the pilot.

## 4. Initial state model

Keep these as orthogonal dimensions rather than a single overloaded status:

| Dimension | Initial states | Meaning |
|---|---|---|
| Device delivery | Pending, Provider accepted, Receipt reported, Failed/Unreachable | Transport facts for each employee phone/work device; notification permission is represented separately |
| Employee response | Unacknowledged, Acknowledged | Whether the employee opened the active incident and the service received the acknowledgement |
| Location availability | Not granted, Available, Revoked/disabled, Unknown | Permission and service availability; acknowledgement is still allowed when unavailable |
| Perimeter observation | On-site, Off-site, Unknown, Stale | Last incident-specific derived result and its age/accuracy; never proof of safety |
| Manual accountability | Follow-up required, Manager-confirmed Safe | Human follow-up outcome, with actor/time; never inferred from phone state |
| Critical popup | Active, Seen | Device popup visibility; Seen is not employee acknowledgement or safety |
| Incident | Active, Resolved | Manager-controlled incident lifecycle |

A phone may be **Device delivery: Receipt reported** while **Employee response: Unacknowledged**. An employee can be **Within perimeter** but still **Manual check** for safety. A manager-set **Safe** outcome must not overwrite the delivery/response history.

## 5. Proposed implementation sequence

### Phase 0 — Repository and project guardrails

- Completed: root [`AGENTS.md`](AGENTS.md) records the product boundary, privacy/safety safeguards, and prototype limitations. Product brief, MVP requirements, backlog, Android feasibility, and backend discovery documents are present.
- In progress: reconcile stale discovery statements and conflicting location/acknowledgement wording; choose one canonical Expo app and one incident-state source before integrating more code.
- Preserve `mobile/` as the tracked push-demo candidate for now. Promote only reviewed and tested pieces from `bouncer-mobile-spike/` or `D:\bouncer-mobile-spike`; do not copy generated Android folders, build outputs, node_modules, credentials, or local environment files.

### Phase 1 — Resolve platform risks

- In progress: the Android feasibility code has passing recorded unit/type/lint/bundle checks. A development APK was installed on the user's phone, but QR scanner/app launch problems prevented scenario validation. The standalone native Release build failed first on a Windows long object path using CMake 3.22.1 and then on an `expo-constants` Gradle configuration error during an attempted CMake override. Use the Expo config plugin to select CMake, regenerate, and record each build result.
- The tracked `mobile/` push demo has a setup and test guide; complete remote-push testing with an installed development build, including denied notification/location permission, background/locked, process stopped, and offline/recovery conditions.
- Validate Android location permission, acknowledgement without location, perimeter classification, freshness, and actual foreground/background reporting separately. Treat five seconds as a target, not a guarantee.
- The Windows source is available. Begin capability/recovery validation without presenting the current overlay as a secure OS lock.
- Update requirements from measured constraints, and do not convert one-device results into a service promise.

### Phase 2 — Domain and service foundation

- Initial Supabase schema and synthetic seed are present. Apply them only to a local database, inspect constraints/RLS, and add automated RLS/domain tests before any hosted employee data. The migration currently establishes read policies and denies direct client writes; privileged mutation functions are not implemented.
- Define API/event contracts and the incident state model before implementing live transports. Preserve separate device delivery, employee acknowledgement, location/permission/freshness, manual safety, and incident lifecycle facts.
- Supabase Auth/Edge Functions are recommended for pilot evaluation, but identity, deployment region, retention, and the Windows agent gateway remain open. Do not put service-role secrets in clients.
- Complete audit/retention behavior and access review before collecting real employee/location data.

### Phase 3 — Incident clients and live delivery

- Implement Android notification tap/deep-link and acknowledgement, then protocol display.
- Implement work-device active incident state, full overlay, critical popup, delivery receipt, heartbeat/reconnect, and resolution handling.
- Connect real FCM and work-device transports only after their semantics and retry policy are proven.
- Keep location optional and incident-scoped; implement only the cadence supported by the Android spike.

### Phase 4 — Pilot readiness

- Exercise declaration, delivery, acknowledgement, manual check, Safe, Seen, denied/unreachable, resolution, audit review, and retention end to end.
- Verify multi-tenant authorization and failure/offline states.
- Define operational targets from pilot data and publish service wording that does not promise guaranteed push delivery.

## 6. Next implementation slice recommendation

First close the Android build blocker enough to install the feasibility build and record the device test matrix; do not substitute a JS export or local notification for native/remote-push evidence. In parallel, refine the existing Supabase schema and API/event contract locally with deterministic tests, keeping mutations inaccessible to clients until server authorization is implemented. Then select a single authenticated incident service boundary and connect one simulated declaration-to-roster flow before enabling real device commands or real employee data. Keep mobile push, Windows delivery, location, and manual safety as distinct adapters and event types.

## 7. Decisions still required after discovery

- How device delivery receipt is represented when FCM accepts/proxies a notification but the client callback is not observed.
- Whether the five-second FCM retry policy should remain, be collapsed into a single notification, or use a different retry cadence.
- The applicable Windows 10 initial release build and compatible Avalonia/.NET target.
- The authentication/session provider and deployment architecture.
- Exact retention/deletion behavior by region and data category.

## Sources checked on 30 October 2026

- [Firebase: Set and manage Android message priority](https://firebase.google.com/docs/cloud-messaging/android-message-priority) — high priority is an immediate-delivery attempt for time-sensitive, user-visible content; it may be deprioritized if not visibly presented.
- [Firebase: Android message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan) — FCM accepting a message does not mean device delivery; offline/device connection affects delivery.
- [Android Developers: Notification runtime permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) — Android 13+ uses `POST_NOTIFICATIONS` permission for ordinary notifications.
- [Android Developers: Background location limits](https://developer.android.com/about/versions/oreo/background-location-limits) — Android may throttle background location; this is a platform constraint to measure, not evidence that a five-second background interval can be guaranteed. Keep reports incident-scoped, expose staleness, and define a safe degraded/manual-follow-up path if updates stop.
- [Android Developers: Android 14 behavior changes](https://developer.android.com/about/versions/14/behavior-changes-14) — full-screen-intent permission eligibility is limited for apps targeting Android 14+ to calling and alarm apps.
- [incident.io: On-call readiness update](https://incident.io/changelog/enhanced-on-call-readiness) — incident.io describes an optional Android alarm-style high-priority notification. This does not establish its delivery architecture or imply Bouncer qualifies for Android full-screen-intent access.
- [incident.io: Mobile app notification update](https://incident.io/changelog/post-feast-treats) — confirms mobile incident-update push notifications and tap-through behavior.
