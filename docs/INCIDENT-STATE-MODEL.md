# Office evacuation incident state model

**Status:** Product decisions recorded; implementation contract still requires technical and operational validation  
**Version:** 0.2  
**Updated:** 3 November 2026  
**Backlog:** [BOU-001](PRODUCT-BACKLOG.md#bou-001--define-the-office-evacuation-journey)

This draft separates incident lifecycle, device delivery, employee response, location evidence, procedure progress, and human accountability. A single label such as “safe” or “present” must not stand in for several of these facts. The model captures the agreed office fire-evacuation direction while leaving safety decisions that still need product-owner input open.

## Invariants

- An incident is scoped to one customer and workplace and snapshots the active employee roster and the published policy version at declaration.
- A declaration attempts notification to every registered employee device in the affected scope, regardless of location permission or perimeter result. Location must never suppress the incident prompt.
- Device delivery is not employee acknowledgement. Acknowledgement is not completion of the evacuation procedure. Neither is proof of physical safety.
- Phone presence evidence is primary; company-device location is separately labeled corroboration and cannot override phone evidence.
- A perimeter or assembly-area result is time- and accuracy-bounded device evidence. Stale or absent reports do not establish that an employee left or arrived.
- Location permission/availability is independent of incident instructions and acknowledgement. Fine-grained reports are allowed only after acknowledgement, during an active incident, and with permission. Stop reporting when the incident ends.
- An employee's explicit **Report safe** action may record `employee_reported_safe` only when a fresh, sufficiently accurate location check falls inside the configured assembly area. This is an employee report corroborated by a geofence signal, not proof of physical safety.
- Manager-marked-safe and manager exception outcomes are separate, audited accountability outcomes. A manager outcome never fabricates or overwrites location evidence.
- Off-site phone evidence never auto-excludes a person; the person remains in the roster until management records an outcome.
- Resolution requires an outcome for every roster member and a separate manager confirmation that the hazard is cleared.
- Abort is a distinct terminal outcome: notify phones that the incident has ended and employees may continue as before, stop incident location/notification retries, and immediately dispatch work-device release commands. Dispatch is not proof of device receipt or release.
- Incident terminal state and per-device command delivery/release state are separate. A disconnected laptop may not receive a release immediately; show that failure and preserve an authorized recovery path.

## Independent state dimensions

| Dimension | Suggested values | Scope and meaning |
|---|---|---|
| Incident lifecycle | `active`, `resolved`, `aborted` | Site-level state. `resolved` records a human hazard-clearance decision. `aborted` records cancellation of a mistaken incident; it is not equivalent to hazard clearance. Both are terminal for that incident. |
| Device delivery | `queued`, `provider_accepted`, `device_receipt_reported`, `failed`, `unreachable` | Per registered phone or Windows device. Provider acceptance is not handset receipt or employee response. |
| Employee response | `unacknowledged`, `acknowledged` | Per employee and incident. Acknowledgement records receipt/response only. The service records the server receipt time; a locally queued acknowledgement is pending until confirmed. |
| Location permission | `not_requested`, `granted`, `denied`, `revoked`, `services_disabled`, `unknown` | Per phone. This never gates the incident-only screen or acknowledgement. Notification permission is its own device setting. |
| Presence observation | `on_site`, `off_site`, `unknown` | A derived, source-labeled observation with observed time, accuracy/confidence, and source (`phone` or `company_device`). Do not turn `off_site` into an automatic roster exclusion. |
| Location freshness | `current`, `stale`, `unavailable` | Derived from the last observation and a threshold still to be selected. Keep the last evidence timestamp, but do not display stale coordinates as current. |
| Procedure/accountability | `follow_up_required`, `employee_reported_safe`, `manager_marked_safe`, `manager_exception` | Per roster member. Employee report is stored with fresh assembly-area evidence and remains distinguishable from a manager's judgement. Manager outcomes record actor, time, and basis; exceptions also require a reason. |
| Laptop restriction/release | `not_targeted`, `command_pending`, `device_acknowledged`, `command_failed`, `release_pending`, `released`, `release_failed` | Per managed Windows device. Does not establish employee presence or safety. The product must not claim the overlay is a secure OS lock. |

The interface may combine facts into readable labels (for example, **Acknowledged — location unavailable**), but the persisted model should keep the facts separate.

## Lifecycle transitions

| Current state | Command/event | Preconditions | Next state | Required record/effect |
|---|---|---|---|---|
| No incident | Declare evacuation | Authenticated, authorized manager; correct customer/site; published policy selected; explicit confirmation | `active` | Snapshot site, policy version, roster, actor, and time. Queue prompts for every registered employee device and applicable restriction commands. |
| `active` | Receive delivery/ack/location/procedure event | Event authenticated, scoped to this incident/device/person, valid and not stale/replayed | `active` | Append evidence with source and timestamp; update the corresponding independent projection only. |
| `active` | Employee presses **Report safe** | Employee acknowledged; permission granted; fresh fix; accuracy bounds wholly within configured assembly area | `active` | Record `employee_reported_safe` with source, time, accuracy and area check. If check fails or is uncertain, retain follow-up and explain why. |
| `active` | Manager marks person safe / records exception | Authorized manager; person is in roster; basis recorded; exception has reason | `active` | Record manager, time, and basis. Do not rewrite delivery, acknowledgement, or location history. |
| `active` | Resolve | Authorized manager; every roster member has employee-reported-safe, manager-marked-safe, or manager-exception outcome; manager confirms hazard cleared | `resolved` | Record actor/time and per-person outcomes. Stop location collection and dispatch phone end-state and laptop release commands; track actual device delivery/release separately. |
| `active` | Abort mistaken incident | Authorized manager; abort reason and effects confirmed | `aborted` | Record actor/time/reason; stop retries and location collection; notify phones that the incident ended and normal activity may resume; immediately dispatch laptop release and track outcomes. |
| `resolved` or `aborted` | Late client event or duplicate terminal command | None | unchanged | Reject or safely deduplicate; do not reopen or apply stale commands. A new real incident gets a new incident ID. |

No transition from an active incident to `resolved` or `aborted` should be implemented client-side as an authorization decision. The server must authenticate the actor, validate site/tenant scope, enforce transition preconditions, and audit the result.

## Cross-client flow

```mermaid
sequenceDiagram
    actor Manager
    participant Admin as Admin app
    participant Service as Bouncer service
    participant Phone as Employee phone
    participant Agent as Windows agent

    Manager->>Admin: Select site and published fire procedure
    Admin->>Service: Confirm declaration
    Service->>Service: Authorize; snapshot policy and roster; audit active incident
    par Attempt prompt to every registered employee device
        Service-->>Phone: Incident prompt (location does not gate delivery)
    and Send separately scoped laptop command
        Service-->>Agent: Incident restriction command
    end
    Phone->>Phone: Show incident-only instructions; location may be unavailable
    Phone->>Service: Acknowledge (independent from location permission)
    opt Employee acknowledged and granted location permission
        Phone->>Service: Incident-scoped location report with time and accuracy
    end
    Phone->>Phone: Employee presses Report safe at assembly area
    Phone->>Phone: Request fresh location fix; check accuracy bounds
    alt Fresh fix is inside assembly bounds
        Phone->>Service: Employee-reported-safe event with evidence
    else Outside, stale, unavailable, or uncertain
        Phone-->>Phone: Keep follow-up state and explain check result
    end
    Agent-->>Service: Device receipt/restriction state, when observable
    Manager->>Admin: Review evidence and manually follow up unresolved people
    alt Hazard cleared and accountability gate satisfied
        Manager->>Admin: Confirm resolve
        Admin->>Service: Resolve incident
        Service-->>Phone: Resolved state
        Service-->>Agent: Release restriction command
    else Incident declared by mistake
        Manager->>Admin: Abort and provide reason
        Admin->>Service: Abort incident
        Service-->>Phone: Incident ended; continue as before
        Service-->>Agent: Immediately dispatch release command
    end
    Service->>Service: Record each dispatch, outcome, actor, and timestamp
```

## Accountability rule: provisional shape

The roster is a declaration-time snapshot of active employees associated with the workplace. Every registered phone is prompted, including phones that report `off_site` or `unknown`. A location result alone never removes a person from the incident history or marks them safe.

The agreed resolution gate is:

1. Every person in the declaration-time roster has an employee-reported-safe outcome (explicit action plus fresh in-area location evidence), a manager-marked-safe outcome, or a recorded manager exception with reason.
2. A phone's `off_site` result alone never excludes or accounts for a person. Management must review and record an outcome.
3. An authorized manager separately confirms that the hazard is no longer present.

The `employee_reported_safe` label must not be presented as human-verified safety. The manager may mark someone safe after direct/offline verification, or record a justified exception. An employee who cannot complete the location check remains in follow-up until management records an outcome.

## Scenario acceptance and TDD matrix

These are the first deterministic domain tests for the implementation slice. They are written as expected behavior; they do not claim that the current prototype passes them all.

| Test case | Given / when | Then |
|---|---|---|
| Declare with location denied | Active incident declared; phone has denied location permission | Notification attempt is queued, incident instructions remain available, acknowledgement is allowed, and location stays unavailable. |
| Prompt all presence outcomes | Registered phones report `on_site`, `off_site`, or `unknown`, or cannot report | Each phone gets an independent delivery attempt; no location outcome suppresses the prompt. |
| Separate delivery and response | Push provider accepts a message but employee has not opened it | Device delivery may be provider-accepted; employee response remains unacknowledged. |
| Acknowledge without location | Employee opens incident-only screen with location denied/revoked/services disabled | Acknowledgement can be recorded without a location observation; show **Acknowledged — location unavailable** when appropriate. |
| Keep pre-ack location private | Incident prompt arrives before employee acknowledgement | Perimeter classification, if available, is computed locally and only a derived result is sent; no raw pre-acknowledgement coordinates are uploaded. |
| Preserve presence after stale reports | A phone has reported on-site, then reports stop past the freshness threshold | Keep the timestamped on-site evidence, mark location stale, request manual follow-up, and do not infer off-site or safe. |
| Keep phone and laptop evidence separate | Phone is unknown/unreachable and laptop reports a site location | Show source-labeled laptop evidence; it cannot overwrite phone presence or automatically account for the person. |
| Reject premature resolution | At least one in-scope person remains unaccounted for, or hazard-clear confirmation is absent | Resolve is rejected and the active incident remains active. |
| Report safe at assembly | Acknowledged employee presses **Report safe**; fresh fix accuracy bounds fall inside assembly area | Record `employee_reported_safe` with timestamp and location evidence; present as employee-reported, not human-verified. |
| Reject assembly report | Location is denied, stale, outside, unknown, or incident terminal | Keep follow-up required and show a reason; do not claim safe. |
| Manager marks safe | Authorized manager records a manual outcome after direct/offline check | Record actor/time/basis separately from employee report and location evidence. |
| Off-site requires review | Phone currently reports off-site | Keep employee in roster; only a recorded manager outcome clears follow-up. |
| Resolve with recorded conditions | Each roster member has employee-reported-safe, manager-marked-safe, or manager-exception outcome and manager confirms hazard clear | Resolve records actor/time, stops location collection, and dispatches phone end-state and device release without claiming devices received them. |
| Abort separately from resolve | Manager cancels a mistaken active incident | Record `aborted`, not `resolved`; notify phones that the incident ended and normal activity may resume, stop location/retries, and immediately dispatch release commands. Track delivery separately. |
| Ignore terminal/late events | Incident is resolved/aborted and a delayed location or command event arrives | Do not reopen the incident or present the event as current; record/reject according to the audit policy. |

TDD order for the code slice: add failing tests for orthogonal state updates and lifecycle guards; implement pure deterministic domain functions; add server integration tests for authorization, tenant/site scope, idempotency, and audit persistence before connecting Android or Windows transports. Platform behavior such as push delivery, GPS accuracy, app suspension, and softlock release requires separate device/system testing.

## Current prototype boundary

`bouncer-mobile-spike/incidentState.ts` provides pure state helpers. `mobile/` now adds a prototype employee action and local API outcome for assembly reporting. Both remain feasibility work: the local service is unauthenticated and in-memory, and there is no durable audit, production authorization, hazard-clear resolution gate, or Windows command dispatch. The prototype stores only the accepted report's result, time, accuracy, and distance from the assembly center; it does not expose raw check coordinates in the manager manifest. Do not promote this behavior as a production contract without privacy, security, retention, and device validation.

## Decisions needed to make this contract Ready

1. What freshness threshold and maximum acceptable location accuracy should the assembly-area check use? The local prototype uses a 15-second maximum age for a tap-triggered fix and requires its accuracy circle to fit inside the configured area. The manager form defaults to a 10 m radius. These are test assumptions requiring Android validation and product approval.
2. What company-device population receives an incident restriction when phone presence is unknown or the phone is unreachable?
3. What retry, reconciliation, and support recovery behavior is required when an abort release command cannot reach an offline laptop?
