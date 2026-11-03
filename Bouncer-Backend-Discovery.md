# Bouncer hosted backend discovery

**Status:** Supabase selected for the pilot implementation path; no hosted project has been created. Production region and customer auth requirements remain launch decisions.

## Recommendation

Start the pilot evaluation with **Supabase hosted Postgres, Supabase Auth, and a small server-side API implemented with Supabase Edge Functions**. Keep Expo Push Service as the push transport for the current Android app. This is a practical fit for a small team: one managed Postgres service can hold the relational workplace and incident data, while the same platform supplies authentication, server functions, and live updates if the manager portal later needs them.

This is a recommendation to prototype against, not approval to store real employee records. Before a customer pilot, confirm the customer’s required hosting jurisdiction, retention rules, contract/DPA terms, access controls, backup/restore expectations, and security review. Supabase projects use one primary region, and changing a project’s region requires creating a new project and migrating. If Bouncer must host different customers in different jurisdictions, that could require separate regional projects and an explicit routing/operations design.

## Why this fits Bouncer

Bouncer’s main records have clear relationships: customers own workplaces; employees can belong to several workplaces; workplaces have roles and protocol versions; incidents snapshot a roster; and deliveries, acknowledgements, manual safety checks, and location observations belong to an incident and employee/device. Postgres supports those relations and constraints directly. A database transaction can enforce one active incident per customer and consistently create the incident, its roster snapshot, its audit event, and notification work.

Supabase Auth supports email sign-in methods, including magic links and one-time codes, and issues sessions/JWTs. It also supports application MFA (TOTP and phone factors) and project-level SAML SSO, including multiple customer IdP connections; SAML SSO is available on Pro and above and has an SSO monthly-active-user charge above included quota. These are real growth paths, though they add plan cost and implementation work when enabled. The app’s own tables would still hold employee identity and customer/workplace roles; the authentication user is only the login identity. Supabase Auth documents integrations for React Native/Expo and enterprise SSO, so the same identity layer can serve the eventual web portal. Windows Avalonia integration should be validated before committing to the provider for the work-device client. [Auth overview](https://supabase.com/docs/guides/auth), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [project SAML SSO and pricing](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)

Supabase Edge Functions are TypeScript server functions that can validate auth, apply server-side business rules, call Postgres, and integrate with third-party services. Keep incident declaration, resolution, push dispatch, and manager safety actions behind these authenticated functions. Enable Postgres Row Level Security and least-privilege grants on exposed tables as defense in depth; never ship a service-role secret to a mobile or browser client. [Edge Functions](https://supabase.com/docs/guides/functions), [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Hosted options considered

| Option | Fit for Bouncer | Tradeoff |
| --- | --- | --- |
| **Supabase (recommended for pilot evaluation)** | Relational Postgres model, built-in Auth, server functions, and optional Realtime | One primary region per project; RLS and grants need careful design and tests; work-device SDK path needs validation |
| **Firebase Auth + Cloud Firestore** | Strong mobile ecosystem and document-oriented storage; transactions and security rules are available | Multi-workplace joins, relational reporting, and append-only incident/audit queries need more application-level modeling; Firestore is explicitly a NoSQL document database |
| **Custom API + managed Postgres + separate identity provider** | Maximum control over API, database schema, deployment, and identity selection | More services and operating work for a solo pilot; choose this if customer requirements exceed Supabase’s region, contract, or enterprise-auth fit |

Firestore can secure data using Firebase Authentication-aware Security Rules and supports transactions, so it is viable. The recommendation favors Postgres because Bouncer’s employee/workplace membership and incident audit data are naturally relational and need trustworthy cross-record operations. [Firestore data model](https://firebase.google.com/docs/firestore/data-model), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [security rules](https://firebase.google.com/docs/rules)

## Suggested pilot architecture

1. **Supabase Auth** identifies the account. Bouncer tables separately map auth users to customer membership, employee records, and roles such as incident manager or standard employee.
2. **Postgres** stores customers, workplaces, employees, memberships, device installations, incident types, versioned protocols, incidents, incident roster snapshots, delivery attempts, acknowledgements, one-time location observations, manual safety outcomes, and an append-only incident event log.
3. **Edge Functions** perform privileged operations: onboarding, incident declare/resolve, device registration, acknowledgement, location submission, and marking an employee safe. Enforce authorization on the server and in database policies.
4. **Notification outbox and worker** separate recording an incident from attempting delivery. Persist each device attempt and provider ticket, then retry eligible unacknowledged devices idempotently. Do not treat provider acceptance as device receipt or employee acknowledgement.
5. **Expo Push Service** can remain the Android transport during the pilot. Expo documents push tickets and later receipts; tickets indicate acceptance by Expo, receipts indicate handoff to FCM/APNs, and neither proves that the employee saw or opened the notification. Expo also states its service has no SLA. Keep Bouncer’s app acknowledgement as the evidence of employee response, and validate the proposed retry cadence against the transport before setting a production guarantee. [Expo push sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo delivery FAQ](https://docs.expo.dev/push-notifications/faq/)
6. **Manager updates** can begin with the current five-second polling model. Supabase Realtime is an optional later improvement; it should not be required for correctness or audit history. [Realtime database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

## Data model rules to carry into implementation

- Scope every customer-owned row by `customer_id`; enforce cross-customer isolation in database policies and server authorization.
- Preserve many-to-many employee/workplace membership. An incident snapshots the affected workplace roster when declared so later onboarding or offboarding cannot rewrite its history.
- Keep device delivery, employee acknowledgement, location result, and manager-entered safety outcome as separate states. A location response must never automatically mean “safe.”
- Record incident actions as append-only events with actor, timestamp, incident, employee/device where applicable, and outcome. Keep a query-friendly current manifest projection if needed.
- Store location as a separate incident-scoped record with an explicit retention window; do not reuse it as ongoing tracking.
- Enforce the single-active-incident rule in the database transaction, scoped to the chosen ownership boundary (initially one customer), not only in UI code.
- Store Expo tickets and receipts, retry state, and terminal delivery errors. Disable stale tokens after `DeviceNotRegistered`; distinguish those provider states from employee response.

## Region, retention, and cost notes

Supabase currently offers a specific Ireland region (`eu-west-1`) as well as broader European choices. A project’s region controls where primary project data is stored, but the vendor states region selection alone is not proof of regulatory compliance. Project region is fixed at creation: a move means creating a new project and migrating, so choose deliberately before importing real pilot data. If the service later promises region selection per customer, plan for a regional deployment strategy rather than assuming one project can place each tenant independently. [Available regions and residency](https://supabase.com/docs/guides/platform/regions), [changing a project region](https://supabase.com/kb/troubleshooting/change-project-region-eWJo5Z)

Supabase offers Free, Pro, Team, and Enterprise plans, with quotas and add-ons; backup coverage differs by plan. The Free plan is suitable for development experiments, not a production incident service. Its current billing and backup terms should be rechecked before pilot deployment. Daily backups are available on paid tiers, while point-in-time recovery is an add-on. Decide the required recovery point and recovery time with the pilot customer; do not treat backups as an incident-data retention policy. [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [backups](https://supabase.com/docs/guides/platform/backups)

## Decisions still needed before a real-data pilot

- First customer’s country/region and any contractual data-location requirement.
- Whether email magic link/OTP meets the customer’s login expectations, or whether SAML SSO/MFA is required from day one; Supabase offers those features, but they need configuration, UX, policy work, and potentially higher plan/usage costs.
- Confirmed identity path for the future Windows Avalonia client.
- Customer retention periods for location observations, operational incident events, exports, and deletion evidence.
- Backup/restore objectives, incident escalation/monitoring, and operational ownership.
- How frequently unacknowledged mobile pushes should be retried and what observable delivery states the service can honestly promise.

## Research basis

The product’s existing MVP requirements and technical discovery plan remain authoritative for behavior and state definitions. Vendor features, pricing, regions, backups, and Expo delivery behavior were checked against the official documentation linked above on 2026-11-01; recheck them before creating a paid project or signing a customer contract.
