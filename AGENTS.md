# Bouncer project directives

This file is the shared source of project goals and working safeguards for agents contributing to this repository. Follow it alongside any more specific instructions in subdirectories. If instructions conflict, surface the conflict and do not silently weaken a safety or security requirement.

## Product goal

Build Bouncer into a dependable, secure SaaS product for businesses operating from regular offices. The long-term product combines company access and on-site accountability with incident response. During an incident, authorized office management can notify people believed to be on site, lock or otherwise restrict company-managed work devices, collect acknowledgements, and monitor accountability toward an administrator-defined procedure such as evacuation to an assembly area.

The MVP focuses on fire evacuation for regular offices, using an Android employee/admin app and a Windows company-device agent. Live door credentialing/unlock is deferred pending access-control integration research. Represent policy definitions as versioned data so later procedures can be added, but do not generalize the MVP into an unvalidated workflow engine. Do not imply that the product is suitable for emergency-critical or regulated environments until those requirements have been researched and validated.

## Product principles

- Treat this as a safety-related accountability product, not merely a notification app or screen overlay.
- Make uncertainty visible. Access events, device check-ins, acknowledgements, and GPS reports are evidence with timestamps and limitations; none alone proves a person's physical safety.
- Provide an explicit, auditable manual-accountability path for people who are unreachable, lack a usable device, or have unreliable location data.
- Fine-grained location reporting to the Bouncer service is incident-scoped. Do not collect continuous background location outside an active incident. The mobile app is intended to require location services and the required app permission to be enabled for normal app features, including future app-based door access; this setup requirement does not authorize continuous location collection or upload. Use local/on-demand location for perimeter decisions where feasible, minimize data sent to the service, communicate permission and location use clearly, and validate platform behavior. During an active incident, the current product concept is an intermittent report approximately every five seconds; show report freshness/accuracy and stop collection when the incident ends.
- Never make Bouncer a barrier to emergency egress or emergency release. App-based entry gating must have a documented fallback and be validated against the site's access-control and life-safety requirements.
- Treat an assembly-area radius as an operational geofence signal, not proof of safety. An employee may explicitly press **Report safe**; only a fresh location check whose accuracy bounds fall inside the assembly area is recorded as **employee reported safe**, with the location evidence and timestamp. Keep this distinct from a manager-marked-safe outcome. Allow authorized, recorded human judgement for exceptions rather than making GPS the sole way to resolve an incident, and require a separate manager hazard-clear decision before incident resolution.
- A device's presence, connectivity, or ability to display an overlay must never be represented as guaranteed. Show delivery/connection state and provide an operational fallback.
- A phone is the primary device signal for estimating employee presence because employees usually carry it; this is not proof of the person's location. Company laptop location may be used as separately labeled, weaker corroborating evidence when the phone is unreachable, but a laptop may be left behind and must never override phone evidence.
- Attempt incident notification to every registered employee device even when location is missing, permission is unavailable, or the device cannot determine whether it is inside the site perimeter. Never suppress the safety prompt based only on a location result.
- Employees must be able to open an incident-only experience and acknowledge an incident without granting location permission. Keep ordinary app features and app-based door entry gated by the required location permission/services, but do not block emergency instructions or acknowledgement. Represent acknowledgement and location availability as separate facts; use a clear combined roster label such as “Acknowledged — location unavailable” when appropriate.
- Keep an auditable incident history for consequential actions: declaration, procedure/site, notification and acknowledgement state, manual status changes, and resolution.
- Minimize personal data. Define purpose, access, retention, and deletion for location and incident records before implementing production collection. Do not log secrets or unnecessary precise location data.

## Security and safety safeguards

- Authenticate and authorize every administrative action and device connection. Enforce tenant, site, and role boundaries server-side; never rely on a hidden UI control for authorization.
- Do not expose unauthenticated endpoints or hub methods that can trigger a lock, unlock, incident, or broadcast. Treat all client-supplied identity, site, incident, and location data as untrusted until verified.
- Use least privilege, secure transport, protected credentials, and auditable authorization decisions. Do not commit secrets, tokens, private keys, or real employee/location data.
- Scope incident commands to the intended tenant, site, incident, and eligible managed devices. Design commands to be authenticated, idempotent, and resistant to replay or stale state.
- Model incident states and transitions explicitly. Reject invalid or out-of-order transitions, and preserve an audit trail for changes and overrides.
- Do not claim the current overlay is a secure operating-system lock or tamper-proof restriction. Validate behavior on supported Windows versions and with company device-management policies before making such claims.
- Preserve an authorized recovery path for administrators and support staff. Avoid changes that could permanently strand a device or prevent legitimate recovery.
- For destructive, security-sensitive, or safety-sensitive changes, describe the risk and intended behavior in the change summary. Do not relax these safeguards to make a demo appear more complete.

## Working conventions

- Before changing code, inspect the relevant implementation and any applicable local instructions. Keep changes focused and explain material assumptions.
- Prefer small, end-to-end product slices with explicit acceptance criteria over broad speculative scaffolding.
- Record consequential product or architecture decisions in documentation in the repository so future sessions do not have to infer them from chat history.
- Treat user proposals as goals to reason about, not implementation instructions to follow blindly. Assess feasibility, safety, privacy, platform constraints, and maintainability; explain material concerns and offer workable alternatives. Ask focused questions when an unresolved choice materially changes behavior or customer commitments, while continuing independent work.
- When requirements are ambiguous, make reversible choices where possible and document the assumption. Ask the user when a decision changes safety behavior, data collection, access control, retention, or customer commitments.
- Do not claim a feature is complete, tested, secure, compliant, or production-ready without evidence. State what was and was not verified.
- Use test-driven development for new or changed behavior: add a focused failing test first, implement the smallest change that passes, then refactor with tests green. Run the relevant tests and checks for each change and report the exact commands and results. Document any case where a behavior cannot reasonably be tested first or automatically.
- Keep documentation and UI language clear about the difference between reported state and verified physical reality.

## Current repository context

The repository currently contains early prototypes and feasibility work:

- `Bouncer.Control` is an ASP.NET Core service with a SignalR hub and a `/lock` endpoint that broadcasts a lock event.
- `Bouncer.Agent` is an Avalonia Windows desktop application with an overlay service that can show a topmost window on detected screens.
- `mobile/` is an Expo/React Native Android push and incident-flow prototype, with a local in-memory development server and manager page. It includes an on-demand assembly-point **Report safe** flow for local testing; it is not an authenticated or persistent backend.
- `supabase/` contains an initial schema, synthetic seed data, and local CLI configuration. No hosted project or authenticated incident API/worker has been created.
- `bouncer-mobile-spike/` contains a partial, tracked Android feasibility spike with TypeScript state/location logic and tests. The fuller Expo Router UI currently being built/tested at `D:\bouncer-mobile-spike` is outside this repository and is not yet integrated as the canonical app.

These prototypes do not yet provide a complete production system with authentication/authorization across clients, tenant or site isolation, managed-device identity, a complete incident lifecycle, reliable delivery, robust lock enforcement, or operational recovery. The local mobile server is unauthenticated and in-memory; the Supabase schema is an initial design only. Treat all existing behavior as prototype behavior. Review and address these gaps before exposing functionality to real organizations or representing it as secure incident management.

## Initial product scope

Unless the user explicitly changes scope, prioritize:

1. Regular offices and company-managed Windows laptops.
2. An evacuation incident with an administrator-defined assembly area.
3. A clear distinction between confirmed present, reported present, last seen, and unknown.
4. Incident notification, device response state, employee acknowledgement, and manual accountability.
5. Incident-only intermittent location reports (approximately five seconds), with visible freshness/accuracy and an explicit stop at resolution.
6. Auditable resolution, including human-reviewed exceptions when device or GPS evidence is unavailable or unreliable.

Do not expand into other industries or emergency procedures until the office workflow is coherent and the user directs that expansion.
