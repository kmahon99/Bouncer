# Bouncer — Product Brief

**Status:** Working product brief; implementation remains prototype stage
**Version:** 0.4
**Updated:** 3 November 2026

## Summary

Bouncer is a SaaS service for coordinating workplace incidents, with evacuations and fire drills as the first use cases. An incident manager declares an incident from Bouncer's administrative service. Employees receive a phone notification that directs them to open the app; opening the incident acknowledges it and displays the workplace's response instructions. Work devices display an incident overlay or a less intrusive popup. Managers monitor delivery, employee responses, and people who still need a manual safety check, then resolve the incident.

The MVP is software-only, targeting Android phones and Windows 10/11 work devices. A customer web portal is planned for workplaces, employees, roles, protocols, device settings, and retention. Billing and live door credentialing are outside the pilot scope.

## Implementation status — 3 November 2026

The repository now contains an Avalonia Windows overlay prototype, an ASP.NET Core/SignalR control prototype, an Expo Android push demo with a local in-memory server and manager page, and an initial Supabase schema with synthetic seed data. The separate Android feasibility spike has passing recorded TypeScript incident/location checks and an Android JavaScript bundle export. A development APK was installed on the user's phone, but QR scanner/app launch problems prevented successful scenario validation; the latest Release build is still blocked. These components are prototypes, not a secure or production incident-management service. The tracking status and outstanding validation are maintained in [the product backlog](docs/PRODUCT-BACKLOG.md) and [Android feasibility spike](docs/spikes/ANDROID-FEASIBILITY.md).

## Problem

During an evacuation or drill, employees need fast, clear instructions. Incident managers need a live view of alert delivery and employee response, plus a practical way to identify people who still need to be checked. A generic broadcast message does not provide a workplace-specific protocol and an incident manifest spanning employee and work devices.

## Product vision

Give workplaces a simple, dependable way to declare an incident, deliver the relevant response protocol, and coordinate an auditable accountability process until an incident manager resolves it.

## Users and customers

- **Customer administrator:** manages subscription and billing, workplaces, employees, roles, incident protocols, device configuration, and retention settings.
- **Incident manager:** declares and resolves incidents, monitors alert delivery and employee status, and records manual safety checks.
- **Employee:** receives an incident notification on Android, opens the app to acknowledge and read instructions, and may enable location tracking for workplace-perimeter checks.
- **Work-device user:** sees the incident on the Windows 10/11 device and is directed to the personal phone app.

## Product experience

### Employee Android app

The app receives an incident notification stating that an incident is active and instructing the employee to open the app for directions. Opening the notification launches the relevant incident in the app and automatically records the employee acknowledgement. The incident view shows the response protocol and assembly-point details.

Employee acknowledgement and location availability are separate. The employee can open incident-only instructions and acknowledge without location permission; the manifest then shows **Acknowledged — location unavailable** as appropriate and leaves the person for manual follow-up. Fine-grained reports are incident-scoped, start only after acknowledgement and permission, and target roughly five-second intervals while the OS, app, battery, and network permit. The manager sees report time, freshness, and accuracy; missed reports become stale and do not prove departure or safety. Location reporting stops when the incident ends. The five-second cadence and background behavior remain subject to Android validation.

### Incident manager manifest

For each declared incident, the manager can monitor device notification delivery and each employee's response/accounting state. The initial roster includes all active employees associated with the workplace. Employees may be associated with multiple workplaces; for a given incident, the relevant location check uses the perimeter of the workplace where that incident was declared.

Employees who remain in **Manual check** can be selected in the manifest and marked **Safe** by a manager after an offline check. The system records the manager and time of this action. Non-responders remain visible for manual follow-up.

### Windows work-device app

The existing Avalonia implementation targets Windows 10/11. During an active incident, the app displays a persistent overlay directing the employee to acknowledge on their personal phone. The service repeatedly pings a work device that has not acknowledged receipt; a device acknowledgement means the broadcast is considered delivered. The active incident state is maintained through a heartbeat/recovery mechanism. Only a resolved broadcast from the service clears the full overlay.

A critical device can instead show a bottom-right corner popup with a cancel button. Closing that popup records a **Seen** status for the device notification. It does not resolve the incident or mark the employee safe.

### Customer web portal

The customer portal allows the customer to:

- Create and manage multiple workplaces and their location perimeters. For the MVP, each perimeter is a rectangular box drawn on a map; custom polygon drawing is a later enhancement.
- Onboard active employees using name and work email address, and assign employee roles such as incident manager or standard employee.
- Configure workplace-specific incident types, response protocols, and assembly points.
- Configure work devices and whether they use the full overlay or critical-device popup.
- Set incident-data retention in line with company policy and applicable regional data-protection requirements.
- Review completed incident records, including incident details, who responded and when, and who remained unaccounted for.

Billing is outside the pilot scope. Stripe is the anticipated billing provider for a later SaaS release.

Authentication and session management for the pilot will use a third-party identity/profile provider, selected during technical discovery.

## MVP goals

1. Let an authorized incident manager declare a configured incident for a workplace.
2. Repeatedly deliver the incident state to enrolled Android phones and provisioned Windows work devices every five seconds while a device has not acknowledged receipt, with delivery within one minute as the initial target.
3. Have opening the phone notification automatically acknowledge the incident and show its workplace-specific instructions.
4. Give managers a real-time incident manifest with notification delivery, employee response, **Manual check**, **Seen** where applicable, and manager-recorded **Safe** outcomes clearly distinguished.
5. Keep Windows full overlays active until an authorized manager resolves the incident; allow a configured corner popup for critical devices.
6. Let customers manage multiple workplaces, employee roles, protocols, and retention through a web portal.
7. Create a reviewable audit record for each incident.

## Out of scope for the MVP

- Physical keycard or access-control integration.
- Desk-booking integration or live seating maps.
- Polygon-based workplace perimeter drawing (the MVP uses a drawn rectangular box).
- Customer billing and subscription checkout in the pilot; Stripe is anticipated for a later release.
- Location collection outside an active incident or a historical continuous movement trail. The manager may view the latest incident-scoped location observations during an active incident, with freshness and accuracy.
- Multiple simultaneous active incidents at one workplace.
- Automated confirmation that a person is safe based solely on acknowledgement or geofence presence.
- Automated employee removal through HR integration; customer administrators manage the active employee roster manually.

## Product principles

- **Clarity under pressure:** incident state, required action, and assembly details are easy to understand quickly.
- **Accountability without false certainty:** delivery, acknowledgement, geofence presence, and manager-confirmed safety are different facts and must not be conflated.
- **Configurable by workplace:** protocols and perimeters reflect each site.
- **Respect operational criticality:** critical devices can show an incident without blocking their primary function.
- **Simple first release:** start with software and manual roster administration, then consider access-control and booking integrations.

## Success measures to validate

- Time from incident declaration to device delivery acknowledgement.
- Time to first employee acknowledgement and acknowledgement rate over time.
- Number and age of employees in **Manual check** during an incident.
- Time to manager-recorded safety outcome for people requiring manual follow-up.
- Time from declaration to incident resolution.
- Successful persistence and recovery of the Windows incident UI during an active incident.
- Completion time and error rate for customer onboarding and incident setup.

Pilot observations should establish numeric targets beyond the initial one-minute device-delivery target.

## Remaining implementation questions

- Define location-check timing, permission-denial behavior, and how stale location is shown. MVP workplace perimeters are rectangular boxes; custom polygon drawing is deferred. Location presence must never be treated as proof of safety.
- Select the third-party identity/profile and session-management provider.
- Validate the five-second device retry interval, recovery behavior, and one-minute initial delivery target on Android and Windows.
- Select and configure Stripe or another billing integration after the pilot.
- Define incident-record deletion behavior when the configured retention period expires, in line with the customer’s regional legal obligations.
