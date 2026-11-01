# Bouncer — Technical Discovery and Implementation Plan

**Status:** Discovery brief  
**Version:** 0.1  
**Date:** 30 October 2026  
**Purpose:** Resolve technical risks and define a first implementation slice for Bouncer's software-only MVP.

## 1. Product decisions to carry forward

- Product: Bouncer, a SaaS service for workplace incidents, initially evacuations and fire drills.
- Clients: Android 13+ employee app, Windows 10 work-device app, and a customer web portal. The target is the initial Windows 10 release if technically feasible.
- Customers manage multiple workplaces, employees, roles, protocols, rectangular map perimeters, retention settings, and later billing. Billing is out of the pilot; Stripe is the anticipated later provider.
- The active incident roster is all active employees associated with the incident workplace. One active incident per workplace is enough for the MVP.
- Opening an incident notification launches the matching phone-app incident, automatically acknowledges it, and displays the protocol and assembly-point instructions.
- Preserve separate state for device delivery, employee response, location presence, manager-entered safety, and critical-device popup seen status. Current user states include **Unacknowledged**, **Acknowledged**, **Manual check**, **Within workplace perimeter**, **Outside workplace perimeter**, **Safe**, **Seen**, **Denied access**, and **Unreachable**. Keep the state dimensions separate in the data model and UI.
- Managers can select an employee in **Manual check** and mark them **Safe** after an offline check. Record manager and time. Neither acknowledgement nor GPS presence proves safety.
- Opening the incident notification brings the Android app to the foreground, automatically acknowledges the incident, triggers an immediate location read, and relays that observation to the server with its timestamp. While the incident screen remains open, refresh the location every five seconds if permission and device conditions allow it. Do not imply background location tracking when the incident screen is not open.
- Work devices receive an incident state and use either a persistent full overlay or a bottom-right critical-device popup with a cancel button. Canceling the popup records **Seen**; it does not resolve the incident.
- The cloud service should retry unacknowledged device broadcasts every five seconds while the incident is active. Investigate whether this is appropriate for Android push; distinguish provider acceptance, device receipt, notification display, employee opening/acknowledgement, and work-device receipt.
- Initial delivery aspiration: within one minute when a device is reachable. This is an engineering target, not a guaranteed service promise.
- Use a third-party identity/profile and session-management provider, selected during technical discovery. Pilot employee identity uses name and work email.
- Customer admins set incident-record retention based on company policy and applicable regional data-protection requirements. Automatic HR/API employee removal is deferred.

## 2. Early technical findings

The local mobile push, acknowledgement, foreground location, and manager manifest/resolve spike now runs end to end. Hosted backend discovery provisionally favors Supabase (Postgres, Auth, and server-side Edge Functions); this is not yet a production provider decision. See [Bouncer-Backend-Discovery.md](Bouncer-Backend-Discovery.md) for the comparison, proposed data model, and outstanding region/auth/retention questions.

### Android urgent notifications

Firebase Cloud Messaging (FCM) high-priority messages are intended for time-sensitive, user-visible content. FCM attempts immediate delivery and can wake a sleeping device in Doze, but the documentation describes an attempt, not a one-minute delivery guarantee. FCM may deprioritize high-priority messages if they do not produce visible notifications. If Android 13 notification permission is denied, the app cannot post ordinary notifications.

FCM's message-send response means that FCM accepted the message, not that the handset received or showed it. Delivery telemetry is therefore a separate event from employee acknowledgement. Notification delegation/proxying can also change which client callbacks and analytics are observed, so device-delivery semantics need a prototype.

Bouncer should send a visible incident notification directly in the FCM payload and render it immediately, without a network fetch before display. The notification tap should deep-link into the incident; the app records employee acknowledgement once the authenticated app handles that tap and reaches the service.

Incident.io's public changelog confirms that it sends incident-related push notifications and has offered Android users an opt-in alarm-style high-priority notification. This is evidence that a polished incident-alert experience is possible, but its public material does not disclose its server/client implementation or guarantee delivery timing. Google Play restricts default full-screen-intent eligibility for Android 14+ apps to calling and alarm apps. Bouncer should not depend on full-screen-intent eligibility without a separate policy and platform review. Investigate high-priority heads-up notifications, sound/vibration, notification channels, and user-configurable alert settings as the baseline.

### Five-second Android location checks

The notification tap opens the Android app in the foreground. On opening, the app immediately reads the permitted location and relays it with the acknowledgement. This foreground read is the MVP location event; it does not require the app to collect location continuously in the background. The desired five-second refresh applies only while the incident screen remains visible. If the user leaves the screen, the app stops the five-second refresh and the manifest uses the last observation time/freshness. Android background-location limits mean five-second updates should not be promised after the app is backgrounded. A future background update design would require separate permission, UX, policy, and battery review.

Therefore, implement an immediate foreground location read when the incident notification is opened, then target **five-second refreshes while that incident screen remains visible**. Validate foreground accuracy, battery use, permission denial, and stale-state behavior. Treat location updates after the app is backgrounded as out of scope for the MVP; record the last observation time and show it as stale when appropriate.

Do not collect location before an employee opens the incident notification, while no incident is active, or after the incident screen leaves the foreground. Do not collect a manager-visible live trail; retain only incident-specific observations needed for the manifest/audit, subject to the retention policy.

### Delivery retry cadence

The existing product decision says to retry device broadcasts every five seconds until the device acknowledges receipt or the incident resolves. This must be tested against FCM high-priority quota/deprioritization behavior and user experience. Sending a new visible high-priority notification every five seconds could create notification spam and risk priority deprioritization. Prototype alternatives include one FCM alert followed by a controlled retry policy, with retry events updating the same notification identifier, while a work device maintains its own persistent incident state/heartbeat.

Do not treat a server-to-FCM success response as delivery. Define per target device: **Queued**, **Provider accepted**, **Device receipt reported** (where observable), **Notification opened / employee acknowledged**, **Denied access**, **Unreachable**, and **Resolved/cancelled**. Keep user-facing and audit labels understandable and avoid promising more delivery certainty than the platform reports.

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

- Defer Windows overlay inspection and implementation until the uncommitted Avalonia source is available from the other system. The current local and remote code repositories are empty, so there is no Windows source to inspect here.
- Confirm whether Windows 10 initial release can support the app's chosen .NET/Avalonia versions, runtime, TLS, device provisioning, and overlay behavior. If not, document the oldest feasible Windows 10 build before selecting dependencies.
- Prototype persistent full-overlay behavior, work-device delivery acknowledgement, heartbeat/reconnect, resolved-state handling, and the critical-device popup/cancel/Seen event.
- Define whether a work-device transport uses WebSocket, server-sent events, push relay, or polling after reviewing hosting and connection constraints. Do not select transport before the deployment model is known.
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
| Device delivery | Pending, Provider accepted, Receipt reported, Unreachable, Denied access | Transport and permission facts for each employee phone/work device |
| Employee response | Unacknowledged, Acknowledged | Whether the employee opened the active incident and the service received the acknowledgement |
| Location presence | Manual check, Within perimeter, Outside perimeter, Stale/unknown, Denied access | Last incident-specific perimeter observation and freshness |
| Manager safety check | Not checked, Safe | Manual manager outcome, with actor/time; never inferred from phone state |
| Critical popup | Active, Seen | Device popup visibility; Seen is not employee acknowledgement or safety |
| Incident | Active, Resolved | Manager-controlled incident lifecycle |

A phone may be **Device delivery: Receipt reported** while **Employee response: Unacknowledged**. An employee can be **Within perimeter** but still **Manual check** for safety. A manager-set **Safe** outcome must not overwrite the delivery/response history.

## 5. Proposed implementation sequence

### Phase 0 — Repository and project guardrails

- Treat the current local and remote code repositories as empty; the Bouncer folder currently contains planning documents but no implementation source. The Windows overlay and the earlier Expo Android spike are uncommitted on another system and unavailable here.
- Before implementation, create a project `AGENTS.md` from the approved product requirements and known constraints. Mark platform/business assumptions and future decisions clearly.
- Record the technology stack, build commands, and current repository state before changing architecture.

### Phase 1 — Resolve platform risks

- Recreate a minimal Expo app in the available workspace and first prove it can launch on the physical Android 13 device. The earlier Expo spike is unavailable and did not run on-device; do not assume its source or configuration can be reused. Only after the basic device run succeeds, add the FCM notification-open/acknowledgement and foreground location experiments.
- Defer the Windows overlay spike until the Avalonia source is available; no replacement overlay is needed for the current MVP planning step.
- Record provider selection for auth only after comparing candidates against the actual stack.
- Update the requirements from measured constraints; do not convert test results from one phone into a delivery SLA.

### Phase 2 — Domain and service foundation

- Choose the first implementation slice after repository discovery. Recommended first vertical slice: customer/workplace setup with a rectangular perimeter, employee records/memberships/roles, incident types and versioned protocols, plus a simulated incident declaration and manifest.
- Define API/event contracts and the state model before implementing live transports.
- Add auth integration and role enforcement when the provider and stack are selected.
- Add audit/retention behavior to the data model before storing real employee location or incident data.

### Phase 3 — Incident clients and live delivery

- Implement Android notification tap/deep-link and acknowledgement, then protocol display.
- Implement work-device active incident state, full overlay, critical popup, delivery receipt, heartbeat/reconnect, and resolution handling.
- Connect real FCM and work-device transports only after their semantics and retry policy are proven.
- Keep location optional and incident-scoped; implement only the cadence supported by the Android spike.

### Phase 4 — Pilot readiness

- Exercise declaration, delivery, acknowledgement, manual check, Safe, Seen, denied/unreachable, resolution, audit review, and retention end to end.
- Verify multi-tenant authorization and failure/offline states.
- Define operational targets from pilot data and publish service wording that does not promise guaranteed push delivery.

## 6. First implementation slice recommendation

First prove the Android development toolchain can run a minimal app on the physical device, because the earlier Expo spike never reached that checkpoint. Then start with **workplace, employee, protocol, and incident domain records plus a simulated manifest**, not live push or location first. This gives the product a testable end-to-end core while Android delivery/location and Windows overlay constraints are being validated. The simulator should let a manager declare an incident, show all active employees for that workplace, and manually set the already-agreed states. Keep delivery channels behind interfaces so the proven FCM and Windows transports can be added without rewriting incident lifecycle logic.

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
- [Android Developers: Background location limits](https://developer.android.com/about/versions/oreo/background-location-limits) — background location is throttled to only a few updates per hour. This supports keeping Bouncer’s five-second refresh foreground-only in the MVP.
- [Android Developers: Android 14 behavior changes](https://developer.android.com/about/versions/14/behavior-changes-14) — full-screen-intent permission eligibility is limited for apps targeting Android 14+ to calling and alarm apps.
- [incident.io: On-call readiness update](https://incident.io/changelog/enhanced-on-call-readiness) — incident.io describes an optional Android alarm-style high-priority notification. This does not establish its delivery architecture or imply Bouncer qualifies for Android full-screen-intent access.
- [incident.io: Mobile app notification update](https://incident.io/changelog/post-feast-treats) — confirms mobile incident-update push notifications and tap-through behavior.
