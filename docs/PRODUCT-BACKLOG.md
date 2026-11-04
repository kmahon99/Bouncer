# Bouncer product backlog

This is the ordered, living backlog for the initial regular-office evacuation product. Priorities indicate sequencing, not estimates: **P0** blocks safe foundations or the first coherent workflow; **P1** is needed for a credible pilot; **P2** improves operation and scale; **P3** is later. Stories begin Proposed and move to Ready only after refinement under [AGILE-WORKFLOW.md](AGILE-WORKFLOW.md).

## Product outcome

Long-term, Bouncer combines company access and on-site accountability with incident response. The initial MVP is incident management for regular offices: fire evacuation only, an Android employee/admin app, and a Windows company-device agent. Physical door credentialing/unlock is deferred. An authorized office manager can declare an evacuation for a site, see what the system knows about employees and their devices, prompt and account for employees, use incident-scoped location as one imperfect signal, handle people who cannot be reached, and record a defensible resolution. The system must show uncertainty and must not imply that a command was delivered or a person is safe without evidence.

## Milestone M0 — Product and technical foundation

### BOU-001 — Define the office evacuation journey
- Status: In progress
- Priority: P0
- User / outcome: As an office manager, I want to declare a configured incident and account for people believed to be on site so that I can coordinate the defined response and make a deliberate, auditable resolution decision.
- Dependencies: Platform capability validation, abort semantics, and personnel eligibility decisions. Policy-owner model and location-permission requirement have been decided at product level.
- Agreed journey (draft):
  1. A designated policy owner is accountable for approving and publishing incident types and response policies for a site. Bouncer has one admin role; policy publication is a special permission within that role. The MVP offers one fire evacuation policy. Store policies as versioned definitions so additional procedures can be added without hardcoding the fire flow, but do not build a general workflow engine for unvalidated future cases. Businesses sharing premises may request policy changes from the designated owner; multi-business policy profiles and their boundaries are a later design problem.
  2. An authorized office manager opens Bouncer on a personal or work device and selects an available incident type from a minimal control panel. Bouncer shows the selected site, procedure, expected effects (including company laptop restriction and incident-scoped location if applicable), and requires explicit confirmation before declaration.
  3. The service creates and audits the incident, then sends an incident prompt to every registered employee phone, regardless of whether the app can confirm its location. The prompt is never suppressed because location permission is missing, the location fix is stale/inaccurate, or the app cannot run its local perimeter check. The phone is the primary signal for the employee's presence: it evaluates location against the configured perimeter locally where possible and sends only a derived result (for example, on-site / off-site / unknown) before employee acknowledgement; raw coordinates are not uploaded at this stage. Location permission, fix freshness/accuracy, and inability to evaluate must be represented.
  4. Confirmed-on-site employees receive the fire evacuation instructions and their linked company laptops receive a separate restriction decision. Employees whose location is unknown still receive the incident prompt and can open instructions/acknowledge; they remain subject to manual follow-up. A phone reporting off-site is evidence for the employee's location at that time, not proof of absence if the report is stale or uncertain. Company-device location can be shown as a secondary, separately labeled signal when a phone is unreachable; it cannot override phone evidence or be presented as employee location because laptops may be left behind.
  5. After the employee responds, the app records an acknowledgement even if location permission is denied, revoked, or unavailable. If location is available, the app may send fine-grained location for the active incident under the defined notice/permission/retention policy. Reports are intermittent (target approximately five seconds when the OS, permission, battery, and network permit), and the admin view shows timestamp, freshness, and accuracy. If acknowledgement succeeds but location does not, the service records both facts and the roster shows “Acknowledged — location unavailable.”
  6. The manager's incident workspace has a roster view and a map view. The roster separates on-site, off-site, unknown/unaccounted, notification, acknowledgement, protocol completion, manual-accountability, and location states. The map shows configured site/assembly points and appropriately fresh employee location reports. Stale or missing reports are not shown as current positions.
  7. The manager can abort a mistaken incident. Abort is distinct from resolve, is audited, stops incident location and notification retries, tells phone users the incident has ended and they may continue as before, and immediately dispatches work-device release commands. Dispatch and device receipt/release remain separate states.
  8. An employee can press **Report safe** at the assembly point. This requests a fresh location check; only a fresh fix whose accuracy bounds fall inside the configured assembly area records **Employee reported safe**. Outside, stale, denied, or uncertain checks leave the person in follow-up. The status is not a claim of human-verified safety. Management can separately mark a person safe after an offline check or record a reasoned exception; both are audited and do not overwrite location history.
  9. A phone reporting off-site never auto-excludes the employee. The employee remains in the roster until management records an outcome. Resolution requires every roster member to have an employee-reported-safe, manager-marked-safe, or manager-exception outcome, and office management must separately confirm the hazard has cleared. Acknowledgement or location alone cannot resolve the hazard.
  10. After the incident, authorized users can review the incident timeline, evidence freshness, exceptions, and resolution/abort actions. Retention follows the defined policy.
- Acceptance criteria:
  - A swimlane or equivalent documents the admin, employee phone, Windows agent, and Bouncer service behavior for declaration, abort, and resolution.
  - It defines the meanings and transitions for site present/off-site/unknown, notified, acknowledged, protocol complete, manually accounted, incident aborted, and incident resolved.
  - It distinguishes local pre-acknowledgement perimeter classification from post-acknowledgement fine-grained location reporting, including the data sent in each phase.
  - It covers unavailable location permission, stale/inaccurate location, no network, dead/offline device, phone/laptop mismatch, and a person who cannot use the app. Incident prompting is sent regardless of pre-acknowledgement location result.
  - An employee can read the incident instructions and acknowledge without granting location; the system records acknowledgement independently from location permission/availability and exposes the combined “Acknowledged — location unavailable” state.
  - It defines which roster population must be accounted for and how a manager records the required human hazard-clearance decision.
  - It records the agreed MVP boundary (fire evacuation only, versioned extensible policy definitions), Android employee/admin mobile app and Windows company agent as initial platform targets, phone-first presence evidence, and separately sourced laptop telemetry.
  - It identifies visitor/contractor registration as future scope while keeping a participant category and site-visit concept possible in the domain model.
  - It records remaining decisions about location freshness/accuracy thresholds, restriction behavior when presence is unknown, and employee/device eligibility; the story remains In progress until remaining safety/privacy decisions are resolved.
- Progress (2026-11-03): The product owner confirmed that off-site evidence does not auto-exclude an employee; employees can press **Report safe** for a fresh assembly-area location check; management can separately mark a person safe; abort notifies phones that normal activity may resume and immediately dispatches work-device release. The story remains In progress because backend authorization, persistence/audit, platform validation, and restriction-scope decisions remain.
- State model: [Incident state model](INCIDENT-STATE-MODEL.md). It captures the agreed independent state dimensions, transitions, client flow, and TDD scenarios. The associated TypeScript functions are a feasibility spike only, not a server contract.
- Prototype progress (2026-11-03): `mobile/` now has an employee **Report safe** screen action, an on-demand high-accuracy location request, conservative accuracy-bound geofence evaluation, an in-memory API result, and a manager manifest label distinct from manager-marked-safe. This is local prototype behavior only; the 15-second fix-age limit and 10 m form default are test assumptions, not approved production thresholds.
- Test plan: Walk through normal evacuation, false alarm/abort, unreachable employee, device offline, and threat-not-yet-cleared scenarios with a representative office manager and employee. Review each state/data transition.
- Platform validation note: Do not promise an incoming-call-like alert or five-second background location until validated per supported platform and permission state. Apple documents that background apps may be suspended and location updates can be delayed; background location requires configured capabilities and user authorization ([background location](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)). Apple Critical Alerts require an entitlement ([Critical Alerts entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts)). Android full-screen intents are permission- and use-case-limited and may render as heads-up notifications while the device is in use ([Android full-screen intent](https://developer.android.com/reference/android/app/Notification.Builder#setFullScreenIntent(android.app.PendingIntent,boolean))).
- Deferred idea (out of initial scope): If app-based delivery is unavailable, evaluate an automated telephone call that asks the employee to acknowledge by voice. Treat this as a discovery/spike only after validating telephony provider coverage, caller trust/spam filtering, cost, accessibility, privacy, and reliability. It must not replace the manual accountability fallback or be presented as guaranteed delivery.

### BOU-002 — Establish threat, privacy, and operational risk register
- Status: Proposed
- Priority: P0
- Dependencies: BOU-001
- Initial risk register:
  | Risk | Impact | Mitigation / validation | Owner | Status |
  |---|---|---|---|---|
  | Mobile OS delays/suppresses persistent incident alerts, or the app is force-stopped/offline | Employee may not receive or act on the prompt | Validate notification capabilities and platform/store policy on supported iOS/Android versions; report delivery/ack state honestly; document redundant site alarm/manual sweep fallback | Engineering + Product | Open |
  | Pre-acknowledgement local geofence cannot run despite setup permission or timely background execution | Employee may be classified unknown; location-based presence is unavailable | Prototype permission and background behavior by platform; keep incident prompt independent of geofence; never treat unknown as off-site; define manual follow-up and user notice | Engineering + Privacy | Open |
  | Local geofence result is wrong because of indoor GPS error, stale fix, spoofing, or device at perimeter | Employee is missed or incorrectly included | Include age/accuracy/confidence where available; test site perimeter edge cases; label result as device-reported; retain manual follow-up | Engineering | Open |
  | Device-reported on-site/off-site result is spoofed or associated with wrong user/device | Incorrect roster and accountability | Enroll/authenticate devices, bind to employee/site, protect transport, audit provenance; do not treat report as proof | Security | Open |
  | Bouncer stores raw fine-grained location longer or exposes it more widely than needed | Employee privacy harm, customer trust/legal exposure | Minimize coordinates, define role access and retention/deletion, restrict logs/exports, perform privacy review before implementation | Product + Privacy | Open |
  | Five-second location collection is unreliable or drains battery | Map appears current when stale; phone battery depleted | Treat five seconds as target not guarantee; show last report time and accuracy; measure battery/platform behavior and stop promptly at terminal incident state | Engineering | Open |
  | Phone reports on-site once, then stops sending location | Admin may mistake stale location for a current position, departure, or arrival | Preserve the initial incident presence evidence; transition only the location freshness to stale/unavailable; prompt manual follow-up; test threshold on Android | Engineering + Operations | Open |
  | Incident declaration/abort/resolution is unauthorized, accidental, duplicated, or applied to the wrong site | Distraction, missed response, or premature release of restrictions | Role/site authorization, confirmation, explicit state machine, idempotency, audit trail, high-risk action review and tests | Security + Engineering | Open |
  | Softlock overlay is bypassed, crashes, fails on a display, or cannot recover | Work continues during incident or legitimate device use is blocked | Define managed Windows enforcement contract and safe recovery; validate platform behavior; communicate exact assurance level | Windows Engineering | Open |
  | Admin incorrectly marks a person accounted for or declares hazard clear | Incident resolved while a person or hazard remains unaccounted | Separate person-accountability and hazard-clearance decisions; require reasoned exceptions and explicit manual hazard confirmation; audit both | Product + Customer Operations | Open |
  | Bouncer service, push provider, or network fails during an incident | Commands/status are delayed or unavailable | Model degraded states; operational playbook and independent site alarms/manual sweep; resilience and restore exercises before pilot | Engineering + Customer Operations | Open |
  | Property owner and tenant administrators issue conflicting policies or assembly points | Wrong response instructions for a site | Define configuration ownership, delegation, precedence, change approval, and version snapshot before enabling multi-party setup | Product | Open |
  | Roster excludes visitors, contractors, shared devices, or employees carrying a different phone | People on site are omitted or attributed incorrectly | Define pilot population and enrollment/device association; support manual add/accountability and disclose coverage limitations | Product + Customer | Open |
  | App entry depends on location services/permission that an employee later disables or cannot grant | Employee may be unable to use app-based access; incident perimeter checks may be unavailable | State the access requirement during setup; detect revoked permission/service state; provide a documented non-app entry fallback; never impede emergency egress or emergency release; validate access-control and local life-safety requirements before deployment | Product + Security + Customer Operations | Open |
  | Multiple businesses share a building with different procedures or assembly areas | One site's policy may not fit every occupant or create conflicting instructions | Start with one designated policy owner and one published active policy per defined site; allow businesses to request changes; before shared-site pilots define site boundaries, policy audience, approval, and conflict handling | Product | Open |
  | Automated voice-call fallback is added without proving deliverability, consent/notice, accessibility, and cost | Calls may be blocked/ignored, expose sensitive incident information, or create false confidence | Keep out of initial scope; run a bounded discovery spike before backlog commitment; preserve manual fallback and truthful delivery status | Product + Engineering + Privacy | Deferred |
- Acceptance criteria:
  - Risks cover unauthorized incident declaration/resolution, cross-tenant access, spoofed devices/events, stale state, data exposure, service outage, device failure, location misuse, and unsafe over-reliance on automation.
  - Each risk has an impact, mitigation or validation action, owner, and status.
  - Privacy questions include notice, purpose, access, retention, deletion, and location visibility; no jurisdictional compliance claim is made without review.
  - Risks are reviewed and reprioritized after platform spikes and before a customer pilot; accepted residual risk has a named approver and recorded rationale.

### BOU-005 — Validate Android incident and location capabilities
- Status: In progress
- Priority: P0
- Dependencies: BOU-001, BOU-002
- Scope: A time-boxed feasibility prototype on a real Android phone; do not treat spike code as production implementation.
- Acceptance criteria:
  - Demonstrate remote push prompt and incident acknowledgement while the app is foregrounded, backgrounded, screen-locked, and after process termination where the platform permits; record actual results and permission/device settings. A local scheduled notification does not satisfy remote-push validation.
  - Demonstrate local site-perimeter classification without sending raw pre-acknowledgement coordinates to the service, including denied permission, disabled location services, stale/low-accuracy fix, and no network.
  - Measure whether incident-scoped location can approach the five-second target while backgrounded and document battery, platform, permission, and OS constraints; do not claim a guarantee.
  - Verify an employee can open the incident-only flow and acknowledge without location permission.
  - Validate the supported notification presentation and escalation path. Do not make incoming-call-style full-screen notification a baseline assumption: Android 14+ limits eligible full-screen-intent apps to calling and alarm use cases, and Google Play may revoke that permission for other apps. See [Android 14 behavior changes](https://developer.android.com/about/versions/14/behavior-changes-14#secure-full-screen-intent-notifications).
  - Record a recommendation for React Native/tooling and native Android integration boundaries. Any code retained beyond the spike follows TDD and security review.
- Progress (2026-11-03): The feasibility spike's TypeScript incident/location rules, 12 Jest tests, type-check, lint, Expo config, and Android JS bundle export have passed in the recorded spike environment; these do not count as device validation. A separate tracked `mobile/` Expo prototype has a remote-push test path and guide, but its required device matrix has not been documented. The user installed a development APK, but QR scanner/app launch problems prevented successful scenario validation. The latest standalone native Release build fails: CMake 3.22.1/Ninja hit Windows' 260-character object-path limit; an attempted CMake 3.31.6 command-line override then failed earlier during `expo-constants` Gradle configuration. No acceptance scenario is confirmed as passed.
- Next: configure CMake with the Expo `expo-build-properties` config plugin, regenerate the native project, build/install a development APK, and record remote-push, permission, and location test results. Do not connect the spike or local unauthenticated server to real employee data.

### BOU-003 — Select supported .NET versions and solution structure
- Status: Proposed
- Priority: P0
- Dependencies: BOU-005
- Acceptance criteria:
  - The support target and lifecycle policy are documented for server and Windows agent.
  - Initial client targets are Android for employee/admin mobile experiences and Windows for the managed company agent; iOS is a later platform target.
  - The Android framework choice (including React Native viability) is made after a small native-capability spike for push, location, permission handling, and device enrollment.
  - The current net10.0 control project and net8.0 agent compatibility decision is resolved.
  - A repeatable local build and CI entry point are documented, with secrets excluded.
  - The architecture separates domain rules from transport, persistence, and UI/platform code sufficiently to test rules deterministically.

### BOU-004 — Establish automated test and CI baseline
- Status: Proposed
- Priority: P0
- Dependencies: BOU-003
- Acceptance criteria:
  - CI restores and builds the solution and runs unit and integration test projects on supported agents.
  - A deliberately failing sample test is shown to fail before its implementation and pass afterward during setup evidence.
  - Test reports are visible in CI and failures block the relevant integration branch.
  - No live secrets, real employee data, GPS, or production tenant is needed to run the suite.

## Milestone M1 — Secure organization and site model

### BOU-010 — Define organization, site, user, role, and device domain model
- Status: Proposed
- Priority: P0
- Dependencies: BOU-001, BOU-003
- Acceptance criteria:
  - Organization and site ownership and membership rules are explicit.
  - Manager, the single admin role, the special policy-publication permission, employee, managed device, and support identities are distinct.
  - One designated policy owner per defined site is accountable for the active published policy. Businesses sharing the site can request changes but cannot publish conflicting policies unless a later shared-site design explicitly supports it.
  - Domain tests reject invalid ownership and cross-organization/site associations.

### BOU-011 — Authenticate administrators and enforce roles
- Status: Proposed
- Priority: P0
- Dependencies: BOU-010
- Acceptance criteria:
  - Administrative API and real-time operations require authenticated identity.
  - Server-side authorization limits actions to assigned organizations/sites and roles.
  - Unauthenticated and unauthorized attempts are rejected, do not mutate state, and are safely auditable.
  - Tests cover permitted and denied roles and cross-tenant/site attempts.

### BOU-012 — Enroll and authenticate company-managed agents
- Status: Proposed
- Priority: P0
- Dependencies: BOU-010
- Acceptance criteria:
  - Only enrolled devices can connect and identify their assigned organization, site, and employee association as configured.
  - Credentials can be revoked and rotation is supported without shipping secrets in the binary.
  - Replayed, revoked, malformed, or wrong-tenant device credentials are rejected.

### BOU-013 — Invite employees and associate their devices
- Status: Proposed
- Priority: P0
- Dependencies: BOU-010, BOU-011, BOU-012
- Acceptance criteria:
  - An admin can create an employee account and issue an expiring, single-use email invitation or enrollment QR code.
  - The employee signs into Bouncer on their Android phone and the company Windows agent is securely associated with that employee through the account/enrollment flow.
  - One employee can have multiple authorized devices; device ownership, last-seen state, revoke/sign-out, replacement, and reassignment are explicit and auditable.
  - Enrollment tokens cannot be guessed, reused, or used across organizations; QR codes are treated as short-lived secrets and do not expose employee data.
  - Visitor/contractor quick registration is not implemented in the MVP, but participant categories can be added later without conflating a visitor with a full employee account.

## Milestone M2 — Presence and site setup

### BOU-020 — Configure site and assembly area
- Status: Proposed
- Priority: P0
- Dependencies: BOU-010
- Acceptance criteria:
  - A user with the policy-publication permission can create/update and publish the site's versioned policy definitions; the MVP offers a fire evacuation policy only, while allowing more definitions to be added later.
  - The policy model can represent additional procedure definitions and site assembly points without changing the incident lifecycle, but no unvalidated procedure workflow is exposed in the MVP.
  - Other businesses sharing the premises can submit a policy-change request to the designated owner; request and publication are separately auditable.
  - Coordinates, units, validation limits, versioning, and change audit are explicit.
  - Invalid coordinates/radii and unauthorized edits are rejected and tested.
  - An incident uses a snapshot of the published policy version active at declaration time.

### BOU-021 — Record device check-in and freshness
- Status: Proposed
- Priority: P0
- Dependencies: BOU-012
- Acceptance criteria:
  - The system records device check-in time and connection state.
  - Admins can distinguish recently connected, stale, and unknown devices.
  - A missed check-in never silently becomes proof that a device or employee is off-site.

### BOU-022 — Prompt registered devices to report site presence
- Status: Proposed
- Priority: P0
- Dependencies: BOU-021, BOU-020
- Acceptance criteria:
  - A registered device can respond that its user believes they are on-site, off-site, or cannot say.
  - The report includes timestamp, device identity, and source; user report is distinct from verified access event.
  - No response is shown as unknown/stale, not absent.
  - Admin views preserve reported status and its freshness rather than presenting it as certain physical presence.
  - The app requests required location permission and checks that device location services are enabled during setup; normal app features are unavailable until requirements are met. Physical door access is not part of the MVP.
  - This permission/setup requirement does not permit continuous background collection or routine upload of fine-grained coordinates. A location decision for entry/presence is local/on-demand where feasible; incident prompts are sent to every registered device regardless of location result.
  - If permission is revoked, location services are disabled, or a device check fails, app-based entry is unavailable and device/accountability state becomes unknown; a documented alternate entry process exists, and emergency egress is never restricted.
  - Open decision: Determine prompt timing, frequency, user friction, and privacy notice through customer discovery before implementation.

### BOU-024 — Enforce mobile location prerequisites for app features
- Status: Proposed
- Priority: P0
- Dependencies: BOU-012, BOU-020, BOU-040
- Acceptance criteria:
  - On supported mobile platforms, the app explains and requests the required location permission and verifies location services are enabled before making app features available.
  - If permission is denied/revoked or location services are off, the app clearly explains which normal app features are unavailable; any future app-based door entry also remains unavailable and uses the documented non-app entry fallback.
  - The incident-only experience remains available without location permission/services so an employee can read the active procedure and acknowledge; no location is fabricated or reported in that case.
  - The requirement does not start continuous location collection or transmit precise location outside a defined feature action or active incident.
  - Incident notification is attempted for all registered devices even when the app cannot run a perimeter check or location is unavailable.
  - Emergency egress and emergency release remain independent from Bouncer app permission/state.
  - Platform tests cover first-use permission, denial, later revocation, services disabled, app update/restart, and supported OS versions.
- Open validation: Confirm app-store policies, permission semantics, and technical feasibility on each selected platform before committing to a specific permission level.

### BOU-023 — Record access events and reconcile presence signals
- Status: Proposed
- Priority: P2
- Dependencies: BOU-054, BOU-021, BOU-022, BOU-024
- Scope: Deferred until a supported access-control integration is selected. Existing customer access-control remains authoritative for door credentials and physical egress.
- Acceptance criteria:
  - Access entry/exit events can be imported with source and timestamp when supported by the selected provider.
  - The presence view shows signal provenance and conflicting/stale reports.
  - Rules never silently discard conflicting evidence or claim certainty from an incomplete tap-in/tap-out record.

## Milestone M3 — Incident lifecycle and accountability

### BOU-030 — Model evacuation incident state transitions
- Status: Proposed
- Priority: P0
- Dependencies: BOU-001, BOU-010, BOU-020
- Acceptance criteria:
  - Incident states, allowed transitions, actors, timestamps, and immutable audit events are defined.
  - Duplicate declaration and repeated commands are idempotent; invalid or stale transitions are rejected.
  - Domain tests cover all transitions, forbidden transitions, concurrency, and duplicate requests.

### BOU-031 — Declare an evacuation for a site
- Status: Proposed
- Priority: P0
- Dependencies: BOU-011, BOU-030
- Acceptance criteria:
  - An authorized site manager sees a clear confirmation of site and procedure before declaration.
  - Declaration creates an incident record and snapshots its relevant site/procedure configuration.
  - Unauthorized, duplicate, and invalid requests do not broadcast or mutate incident state.
  - Audit records identify actor, site, time, and incident.

### BOU-032 — Deliver scoped incident commands to agents
- Status: Proposed
- Priority: P0
- Dependencies: BOU-012, BOU-030, BOU-031
- Acceptance criteria:
  - Only eligible enrolled devices for the incident's site receive the command.
  - The service tracks command queued/sent/acknowledged/failed or unknown state without calling queued delivery success.
  - Disconnected devices receive current incident state on reconnection without replaying stale commands incorrectly.
  - Integration tests cover site isolation, reconnect, duplicate, stale, and revoked-device cases.

### BOU-033 — Show incident prompt and collect employee acknowledgement
- Status: Proposed
- Priority: P0
- Dependencies: BOU-032
- Acceptance criteria:
  - The employee prompt clearly states incident type, required action, and acknowledgement action.
  - Acknowledgement is associated with employee, device, incident, and timestamp.
  - Acknowledgement succeeds independently of location permission; the server records location availability separately and the roster can show “Acknowledged — location unavailable.”
  - Duplicate acknowledgement is safe; delayed acknowledgement is recorded with its actual time and current incident state.
  - UI tests/manual checks cover accessibility, multiple displays, dismissal/restart behavior, and unavailable service states.

### BOU-034 — Show accountability roster and unreachable state
- Status: Proposed
- Priority: P0
- Dependencies: BOU-021, BOU-022, BOU-033
- Acceptance criteria:
  - The manager can see each person believed to be present, presence evidence/freshness, notification state, acknowledgement, and location state separately.
  - Missing, unreachable, and unknown are distinct from safe or absent.
  - Acknowledged employees with unavailable/revoked location permission are distinct from unacknowledged/unreachable employees, and their location state is explicit.
  - Acknowledgement without location is not displayed as assembly-point arrival or protocol completion; the roster indicates the next accountability action required by the procedure.
  - Filters and summary counts agree with the roster and do not hide exceptions.

### BOU-035 — Record manual accountability and exceptions
- Status: Proposed
- Priority: P0
- Dependencies: BOU-034
- Acceptance criteria:
  - Authorized manager can record an allowed manual status with reason and timestamp.
  - The system records who made/changed it and retains prior values in the audit trail.
  - Manual status is visually distinct from device acknowledgement or location evidence.
  - Unauthorized edits and invalid status changes are rejected and tested.

## Milestone M4 — Incident-scoped location and resolution

### BOU-040 — Define location privacy and retention behavior
- Status: Proposed
- Priority: P0
- Dependencies: BOU-002
- Acceptance criteria:
  - Product decision specifies employee notice, visibility, purpose, retention period, deletion path, and administrative access for precise location and derived status.
  - Collection begins only for an active incident and ends on resolution/cancellation or other explicitly defined terminal state.
  - Product language does not imply collection outside the declared scope.
- Gate: Do not implement production location retention until this story is resolved.

### BOU-041 — Collect intermittent location reports during active incident
- Status: Proposed
- Priority: P0
- Dependencies: BOU-012, BOU-030, BOU-040
- Acceptance criteria:
  - During an active incident, a permitted employee device can send reports targeted at approximately five-second intervals when platform permissions and connectivity allow.
  - No reports are collected outside an active incident; resolution stops further collection promptly.
  - Reports carry timestamp and horizontal accuracy where available; missing permission, stale report, and unavailable fix are explicit states.
  - If an employee is initially reported on-site and later location reports stop, preserve their incident presence/accountability status and change only the location freshness state to stale/unavailable after a configurable threshold; never silently mark them off-site, at the assembly point, or resolved.
  - The stale-location threshold is based on the target interval and measured platform behavior. A candidate such as three missed report intervals may be evaluated during device testing, not treated as a final product constant.
  - The admin roster clearly prompts manual follow-up when an on-site employee's location becomes stale. Any laptop location appears as a separate secondary device signal and does not replace the phone-derived employee location.
  - If a company laptop reports location while its associated phone is unreachable, show it as a separate device signal that may inform manual investigation; do not use it alone to conclude the employee's location or presence.
  - Tests use injected clock/location sources and cover throttling, duplicates, stale/out-of-order reports, permission denial, and incident termination.

### BOU-042 — Calculate reported assembly-area proximity
- Status: Proposed
- Priority: P0
- Dependencies: BOU-020, BOU-041
- Acceptance criteria:
  - The system reports whether a sufficiently fresh fix is within the configured radius, while showing the fix's accuracy and age.
  - Boundary, missing, stale, inaccurate, and out-of-order reports produce deterministic, tested outcomes.
  - UI wording communicates a location signal, not proof of physical safety.

### BOU-043 — Resolve incident with audit and exceptions
- Status: Proposed
- Priority: P0
- Dependencies: BOU-034, BOU-035, BOU-042
- Acceptance criteria:
  - Resolution is blocked while required accountability is unresolved unless an authorized manager records a reasoned exception under the approved policy.
  - Resolution records actor, time, roster/status summary, exceptions, and incident configuration.
  - Resolution ends location collection and sends a scoped end-state to connected/reconnecting clients.
  - Tests cover normal resolution, unresolved roster, exception authorization/audit, duplicate resolution, and disconnection.

## Deferred discovery — physical access integration

### BOU-054 — Research door access integration options
- Status: Proposed
- Priority: P2
- Scope: Discovery only; physical door credentialing/unlock is excluded from the initial MVP.
- Acceptance criteria:
  - Identify at least one target access-control provider and determine supported APIs/SDKs, partner approval/NDA requirements, credential issuance model, entry-event availability, sandbox/hardware needs, fees, and emergency egress behavior.
  - Compare app-owned credentials with integrating/deep-linking to an existing provider app; document what Bouncer can safely own versus what remains with the access-control system.
  - Produce a recommendation and a separate implementation backlog only after a customer/site and vendor integration path are confirmed.
- Preliminary research: Alta Open (Avigilon Alta Access) uses phone capabilities including BLE, Wi-Fi/LTE, and location for access; official app listing says it works with Alta Access systems. Avigilon provides an integration/technology partner path, but public findings do not establish whether Bouncer can embed the mobile credential or the exact partner/SDK terms. Validate directly with the vendor before depending on it. [Alta Open app listing](https://play.google.com/store/apps/details?id=com.openpath.mobile), [Avigilon Technology Partner Program](https://www.avigilon.com/technology-partner-program), [Alta Access documentation library](https://docs.avigilon.com/bundle).

## Milestone M5 — Windows device behavior and operational readiness

### BOU-050 — Define company laptop restriction and recovery contract
- Status: Proposed
- Priority: P0
- Dependencies: BOU-001, BOU-002
- Acceptance criteria:
  - Supported Windows versions, company management assumptions, exact restriction behavior, administrator bypass, recovery, crash/restart behavior, and remote-management interaction are documented.
  - User, admin, and support recovery paths are reviewed before enforcement implementation.
  - Prototype overlay is not described as an OS-level secure lock unless validated as such.

### BOU-051 — Implement incident restriction state in Windows agent
- Status: Proposed
- Priority: P0
- Dependencies: BOU-032, BOU-050
- Acceptance criteria:
  - Agent reflects authenticated current incident state and can recover state after restart/reconnect.
  - Restriction begins and ends only on valid scoped state transitions.
  - The authorized recovery mechanism is tested, logged, and cannot be invoked by an ordinary unauthorized user.
  - Platform tests/manual validation cover multiple monitors, display scaling, sleep/resume, process restart, network loss, and accessibility needs.

### BOU-052 — Build an operational failure and support playbook
- Status: Proposed
- Priority: P1
- Dependencies: BOU-032, BOU-034, BOU-050
- Acceptance criteria:
  - Playbook covers service outage, notification failure, disconnected agent, unreachable employee, lost device, inaccurate location, emergency override, and post-incident review.
  - Admin UI states what manual action is needed and does not imply unsupported delivery or safety guarantees.
  - Support escalation and event records preserve necessary diagnostics without secrets or excessive personal data.

### BOU-053 — Pilot readiness review
- Status: Proposed
- Priority: P1
- Dependencies: M0-M5 P0 stories
- Acceptance criteria:
  - A staged pilot checklist covers security review, privacy review, Windows compatibility, restore/recovery, monitoring, backups, incident exercises, and customer training.
  - A tabletop exercise includes normal evacuation, unreachable person, stale presence, offline laptop, GPS failure, and administrator error.
  - Known gaps and pilot limitations are documented and accepted by the product owner before real deployment.

## Backlog refinement questions

Resolve these in discovery before their dependent stories become Ready:

1. Which access-control provider is the best first integration target after the deferred BOU-054 research?
2. What company-managed laptop management baseline is assumed (for example, centrally managed Windows devices)?
3. Which identity provider and account lifecycle should the first customer use?
4. What should a confidently off-site phone's employee see after the broadcast incident prompt, and should the prompt be dismissible without acknowledgement?
5. What freshness threshold should turn a phone's last location into “stale” and trigger manual follow-up, based on real Android behavior and network testing?
6. How should an employee be classified if their phone never reports but the associated laptop reports from the site or from elsewhere?
7. What evidence and human decision are sufficient to resolve an incident when an employee/device cannot be reached?
8. Which supported Windows management/lock mechanism meets the required restriction and recovery contract?

Product decisions already made: MVP is fire evacuation only with versioned, extensible policy definitions; Android employee/admin app and Windows company agent are initial targets; incident prompts are attempted for every registered employee phone even when location is unknown; the phone is the primary employee-presence signal and company-device location is secondary evidence; an employee can acknowledge without location; location services and permission gate normal app features; one designated policy owner publishes the active policy; visitors/contractors are future scope; and physical door credentialing is deferred. Platform, privacy, access-control, and life-safety details still require validation before implementation.

## Current status

As of 2026-11-03, BOU-001 (office evacuation journey) and BOU-005 (Android feasibility) are In progress; no story is Done. BOU-002 through BOU-004 and implementation stories remain Proposed. The repository now contains Windows prototypes, a separate Expo push demo, an initial Supabase schema, and part of the Android feasibility spike. These are foundations only: no authenticated/persistent incident workflow or successful Android acceptance scenario is confirmed. Immediate work is to close BOU-001's remaining safety decisions, unblock and run the Android build/device matrix for BOU-005, then refine the backend/client contract and CI foundation before connecting clients to real data. Physical access integration remains deferred to BOU-054.
