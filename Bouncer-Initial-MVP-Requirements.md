# Bouncer — Initial MVP Requirements

**Status:** Draft requirements  
**Version:** 0.3  
**Updated:** 29 October 2026

## 1. Scope and terminology

These requirements describe the software-only MVP for workplace incident coordination. Supported clients are Android 13 or later for employee phones and Windows 10 for work devices. The target is the initial Windows 10 release where technically feasible; compatibility must be validated during technical discovery. The customer administration surface is a web portal.

The initial roster for an incident is all active employees associated with the workplace where the incident is declared. An employee may be associated with more than one workplace. The location check for an incident uses that incident's workplace perimeter. There is no need to support overlapping active incidents at a single workplace in the MVP; at most one incident may be active per workplace at a time.

### Distinct state concepts

- **Device delivery:** whether a phone or work device has acknowledged receipt of the cloud broadcast. This is not the employee acknowledgement.
- **Employee response:** whether the employee opened the incident from the notification/app and acknowledged it.
- **Location presence:** whether an enabled location check reports the employee's device within the incident workplace perimeter. This does not prove safety.
- **Manual check / Safe:** before location tracking is enabled, the employee is listed as **Manual check**. During an incident, a manager may record **Safe** after a manual check. **Safe** is a manager-entered outcome, not a system inference.
- **Seen:** a critical-device popup was closed by its cancel button. This is a device-notification state, not incident resolution or employee safety.

### Roles

- **Customer administrator:** manages billing, workplaces, employees, roles, protocols, device configuration, and retention settings.
- **Incident manager:** declares/resolves incidents, views the manifest, and records manual safety outcomes.
- **Standard employee:** receives alerts and reads instructions.
- **Work device:** a provisioned Windows 10/11 device assigned to a workplace and presentation mode.

## 2. Functional requirements

### A. Customer portal, organization, and onboarding

- **ORG-01** The service shall provide a customer web portal.
- **ORG-02** The customer administrator shall be able to create, edit, and deactivate multiple workplaces within the customer account.
- **ORG-03** Each workplace shall have a configured property perimeter usable for incident-specific location checks. For the MVP, the perimeter shall be a rectangular box drawn on a map.
- **ORG-04** The customer administrator shall be able to add, edit, deactivate, and associate employees with one or more workplaces using at minimum employee name and work email address.
- **ORG-05** The customer administrator shall be able to assign and revoke at least the **Incident manager** and **Standard employee** roles.
- **ORG-06** The service shall treat all active employees associated with the incident workplace as the initial incident roster.
- **ORG-07** The customer administrator shall be able to provision a Windows work device to a workplace and configure its incident presentation mode.
- **ORG-08** Customer billing and subscription checkout are outside the pilot scope. The product should be able to add SaaS billing later; Stripe is the anticipated provider, subject to technical discovery.
- **ORG-09** The customer administrator shall be able to configure the retention period for incident records to match company policy and applicable data-protection requirements in the customer’s region.
- **ORG-10** When a retention period expires, incident data shall follow the configured retention/deletion policy and applicable regional data-protection requirements. Deletion behavior shall be auditable. Exact legal and technical deletion mechanics must be defined before production.

### B. Authentication and authorization

- **AUTH-01** The pilot shall use a third-party identity/profile and session-management provider for user authentication and session handling.
- **AUTH-02** The application shall associate authenticated users with a customer account, workplace membership, and assigned role.
- **AUTH-03** The service shall authorize portal, incident, and manifest actions according to customer, workplace, and role.
- **AUTH-04** Users shall only access customer and workplace information for which they are authorized.
- **AUTH-05** Employee identity records shall include at minimum name and work email address.

### C. Workplace incident types and protocols

- **CFG-01** The customer administrator shall be able to create and edit workplace-specific incident types.
- **CFG-02** Each incident type shall have a name and response protocol.
- **CFG-03** A response protocol shall support written actions and human-readable assembly-point location information.
- **CFG-04** Incident types shall be associated with one or more workplaces and made available to authorized incident managers there.
- **CFG-05** The service shall retain the protocol version associated with each incident so the audit shows the instructions in effect when it was declared.

### D. Incident declaration, delivery, and lifecycle

- **INC-01** An authorized incident manager shall be able to declare one configured incident type for a workplace.
- **INC-02** The service shall allow at most one active incident per workplace at a time.
- **INC-03** On declaration, the service shall record incident ID, customer, workplace, incident type, protocol version, declaring manager, and declaration time.
- **INC-04** The service shall initiate broadcasts to all active employees on the incident workplace roster and all work devices provisioned to that workplace.
- **INC-05** While an incident remains active, the service shall repeatedly ping each target device until it acknowledges receipt or the incident is resolved.
- **INC-06** A device's acknowledgement of the broadcast shall cause the service to record that device notification as delivered, with an event time.
- **INC-07** Device delivery acknowledgement and employee acknowledgement shall be recorded and displayed separately.
- **INC-08** The manager shall be able to view active incidents and their current delivery and employee response status in real time or as close to real time as the service connection permits.
- **INC-09** An authorized incident manager shall be able to resolve an active incident.
- **INC-10** On resolution, the service shall record resolving manager and resolution time and send a resolved state to affected work devices.
- **INC-11** The service shall not automatically resolve an incident because devices received the broadcast, employees acknowledged, or a geofence check reports presence.
- **INC-12** The service shall reject or prevent a second active incident at the same workplace while one is already active.

### E. Employee Android app and location presence

- **EMP-01** The Android app shall receive incident notifications for workplaces with which the employee is associated.
- **EMP-02** The notification shall state that an incident is active and instruct the employee to open the app to view the instructions.
- **EMP-03** Opening/tapping the incident notification shall launch the app at the relevant incident and automatically acknowledge the incident for the signed-in employee.
- **EMP-04** If the employee opens the incident from within the app rather than the notification, the app shall provide an equivalent acknowledgement action.
- **EMP-05** After opening the incident, the app shall display the associated response protocol and assembly-point information.
- **EMP-06** The app shall show whether the incident remains active or has been resolved.
- **EMP-07** The app shall record the employee acknowledgement event against the employee and incident and report it to the service.
- **EMP-08** If the service cannot confirm receipt of an acknowledgement, the app shall show it as pending or failed rather than falsely confirming server receipt.
- **EMP-09** On first use, the app shall request precise location permission before enabling incident workplace-perimeter checks. The employee must be able to see and manage the permission state. If the employee denies required notification or location access, the incident-linked employee record shall show **Denied access**.
- **EMP-10** Until the employee has opened the app and enabled location tracking, the employee's incident accounting state shall default to **Manual check**.
- **EMP-11** When an employee opens the incident notification, the Android app shall immediately read the permitted device location and relay it with the incident acknowledgement. While the incident screen remains visible, the app shall refresh the location every five seconds when permission and device conditions allow. It shall evaluate each observation against the incident workplace perimeter and record its timestamp. When the app leaves the foreground, five-second refreshes stop; the manifest shall show the last observation time and mark it stale when appropriate. Background location tracking is out of scope for the MVP.
- **EMP-12** Location presence shall be shown separately from employee acknowledgement and manager-entered safety status. Presence shall never automatically mark an employee **Safe**.
- **EMP-13** If location permission is denied, the incident-linked employee record shall show **Denied access**. If the employee/device cannot be reached after the delivery retry process, the record shall show **Unreachable**. If location is disabled, stale, or unavailable without a denial, the accounting state shall remain **Manual check** and the manager shall be able to distinguish the reason where available.
- **EMP-14** The MVP shall not provide the incident manager with a live map or continuous employee location tracking.

### F. Incident manifest and manual safety checks

- **MAN-01** The incident manager shall be able to view the incident manifest for all active employees associated with the incident workplace.
- **MAN-02** The manifest shall present distinct fields or indicators for employee response, device delivery, and location/accounting state so they cannot be confused. The incident-linked employee record shall also expose **Denied access** and **Unreachable** where applicable.
- **MAN-03** Employee response shall include at least **Unacknowledged** and **Acknowledged** states.
- **MAN-04** Device delivery shall distinguish **Pending delivery** from **Delivered** for each target device, with a failure/offline state when known.
- **MAN-05** Location/accounting shall show **Manual check** until the employee enables location tracking and a usable location result is available; it may then show **Within workplace perimeter** or **Outside workplace perimeter** with the observation time.
- **MAN-06** During an incident, an authorized manager shall be able to select an employee listed as **Manual check** and mark them **Safe** after an offline/manual check.
- **MAN-07** A manager-entered **Safe** outcome shall record the acting manager, timestamp, and incident. It shall be visibly distinguished from automatic/system state.
- **MAN-08** The manifest shall retain unacknowledged and unresolved manual-check employees for follow-up until the incident is resolved; resolution shall not silently relabel them as safe.
- **MAN-09** The interface shall not imply that an alert acknowledgement or a geofence result alone proves that an employee is safe or evacuated.

### G. Windows 10 work-device app

- **WRK-01** A provisioned Windows 10 device shall receive incident and resolution broadcasts for its assigned workplace.
- **WRK-02** On receiving an active incident, the work-device app shall show the incident and direct the user to acknowledge it on their personal phone.
- **WRK-03** The app shall acknowledge receipt of a broadcast to the service; this confirms device delivery only, not employee response.
- **WRK-04** The app shall support **Full overlay** and **Critical-device popup** presentation modes configured per device.
- **WRK-05** In Full overlay mode, the incident overlay shall remain active until the service sends the valid resolved state for that incident. A standard employee shall not be able to dismiss it.
- **WRK-06** The work-device app shall use a heartbeat or equivalent mechanism to maintain or recover active incident state while the incident remains active.
- **WRK-07** A Critical-device popup shall appear in the bottom-right corner of the screen and include a cancel button.
- **WRK-08** If the user cancels/closes a Critical-device popup, the app shall record a **Seen** event with the device and event time. **Seen** shall not resolve the incident or mark an employee safe.
- **WRK-09** The popup's cancel action shall close the popup for that device notification; the service shall continue the incident broadcast/heartbeat behavior while the incident is active, according to the delivery policy.
- **WRK-10** The work-device app shall handle duplicate, delayed, and out-of-order incident and resolution messages without reopening an incident already resolved by the latest service state.
- **WRK-11** If the device cannot confirm current service state, it shall display or otherwise expose a stale/offline condition and reconcile when connectivity returns.

### H. Incident record and audit

- **AUD-01** Each incident shall create a real-time incident record containing incident details, workplace, incident type/protocol version, declaring manager, and timestamps.
- **AUD-02** The incident record shall capture device delivery events, employee acknowledgements, location-presence observations used for the incident, manager-entered **Safe** outcomes, and critical-device **Seen** events, with actor/device and event time as applicable.
- **AUD-03** The record shall identify employees who were not accounted for when the incident was resolved, without changing their status to safe.
- **AUD-04** The record shall capture the resolving manager and resolution time.
- **AUD-05** After resolution, authorized customer administrators shall be able to review the incident audit in the web portal.
- **AUD-06** Records shall follow the customer-configured retention period.
- **AUD-07** Material changes to employee status, protocols, workplace perimeters, roles, and retention settings shall be auditable with actor and time.

### I. Billing and service operation

- **BILL-01** Billing and subscription checkout are not required for the pilot. Stripe is the anticipated provider for a later release.
- **OPS-01** The service shall expose device delivery and connection status sufficiently for incident managers to distinguish unacknowledged delivery from known device non-response where measurable.
- **OPS-02** The service shall retry broadcasts every five seconds to devices that have not acknowledged receipt, and stop retries for a device when it acknowledges delivery or the incident is resolved. The initial target is delivery acknowledgement within one minute for reachable devices.
- **OPS-03** The service shall retain event timestamps consistently and show an understandable time zone in the portal and audit.

## 3. Non-functional requirements

- **NFR-01 Reliability:** Declaration, notification delivery, acknowledgement, and resolution shall use retry and recovery behavior and expose failures. Device broadcasts shall retry every five seconds; the initial delivery target is within one minute for reachable devices. Broader service availability targets remain to be set before a production pilot.
- **NFR-02 Security:** Data in transit and stored data shall be protected using appropriate security controls; access shall follow least privilege.
- **NFR-03 Privacy:** Location is used for incident workplace-perimeter presence only in the MVP. An immediate location read occurs when the employee opens an incident notification; five-second refreshes are desired only while that incident screen remains visible. There shall be no background location tracking or manager-facing live map in the MVP. Permission purpose and behavior must be clear to employees.
- **NFR-04 Usability:** Employees and managers shall be able to identify incident state and next action quickly under stressful conditions.
- **NFR-05 Accessibility:** Essential incident instructions and controls shall not rely on color alone and shall support readable text and assistive technologies on supported platforms.
- **NFR-06 Auditability:** Important incident and configuration actions shall include actor/device and timestamp information sufficient for review.
- **NFR-07 Platform support:** MVP clients shall support Android 13 or later and Windows 10 work devices, targeting the initial Windows 10 release where technically feasible. Validate OS and device-management compatibility before pilot deployment.
- **NFR-08 Retention:** The service shall apply the customer's configured retention period to incident records in line with company policy and applicable regional data-protection requirements, and explain the effect in the portal.

## 4. Initial acceptance scenarios

1. **Declare and deliver:** Given an authorized manager and configured incident, when the manager declares it for a workplace, then the service creates an incident record and pings active roster phones and provisioned work devices every five seconds until each device acknowledges receipt or the incident is resolved; the initial target is delivery acknowledgement within one minute for reachable devices.
2. **Open notification and acknowledge:** Given an employee with the Android app, when they open the incident notification, then the app opens the corresponding incident, records the employee acknowledgement, and shows that incident's protocol and assembly details.
3. **Separate delivery from response:** Given a phone or work device has acknowledged the cloud broadcast but the employee has not opened the phone incident, then the manager sees device delivery as Delivered and employee response as Unacknowledged.
4. **Default manual check:** Given an active employee has not opened the app and enabled location tracking, when the manager views the incident manifest, then the employee is in Manual check for accounting purposes. If location permission was denied, the incident record identifies Denied access. If the device remains unreachable after retries, the record identifies Unreachable.
5. **Perimeter presence:** Given an employee has enabled location permission and a usable location observation is available, when an incident is declared at a workplace associated with that employee, then opening the notification triggers an immediate perimeter check and relays the result with the acknowledgement; while the incident screen remains visible, the app refreshes every five seconds when possible and shows each result and observation time without marking the employee Safe. Once the app leaves the foreground, refreshes stop and the last observation is marked stale when appropriate.
6. **Manager marks safe:** Given an employee is in Manual check, when an authorized manager selects the employee and marks them Safe after an offline check, then the audit records the manager, time, and incident and the manifest distinguishes this manual outcome.
7. **Resolve and audit:** Given an active incident, when an authorized manager resolves it, then work-device apps receive the resolved state and the completed audit is available in the customer portal, including people not accounted for at resolution.
8. **Full overlay:** Given a Windows device is configured for Full overlay, when it receives an incident, then the overlay directs the employee to the phone and cannot be dismissed by an ordinary employee action; it closes when the service sends resolution.
9. **Critical popup seen:** Given a Windows device is configured for Critical-device popup, when it receives an incident, then a bottom-right popup with a cancel button appears; if canceled, a Seen event is recorded, while the incident remains active.
10. **Single active incident:** Given a workplace already has an active incident, when a manager attempts to declare another incident at that workplace, then the second declaration is prevented or rejected with a clear explanation.
11. **Retention:** Given an incident record reaches the configured retention limit, then the service applies the configured retention behavior and does not expose the expired record as retained audit data.

## 5. Explicitly deferred

- Custom polygon workplace perimeter drawing (the MVP uses a rectangular box).
- Customer billing and subscription checkout during the pilot; Stripe is anticipated for a later release.

- Keycard, physical access-control, or building-management integration.
- Desk-booking integration and seating maps.
- Manager-facing live employee location maps or continuous tracking.
- Multiple simultaneous incidents at a single workplace.
- Automated employee removal through HRIS/API integration.
- Automated confirmation that an employee is safe based only on acknowledgement or location presence.
- Additional employee actions beyond opening the incident, acknowledgement, and reading its protocol.

## 6. Decisions recorded

1. **Notification flow:** Notification states that an incident is active and tells the employee to open the app. Opening/tapping it opens the matching incident, automatically acknowledges it, and displays instructions.
2. **Roster:** The incident roster contains all active employees associated with the workplace where the incident is declared.
3. **Location and default accounting:** An employee starts in **Manual check** until they open the app and enable precise location tracking. The enabled location may be checked against the relevant workplace perimeter; it is not proof of safety. The MVP has no manager-facing live location map. MVP perimeter is a rectangular box drawn on a map; custom polygon drawing is deferred.
4. **Manual safety check:** During an incident, the manager selects an employee in the manifest and marks them **Safe** after an offline check. The service records who and when. Employees without an app or unable to respond remain visible for follow-up.
5. **Administration:** A customer web portal manages protocols, multiple office locations, employee roles, device configuration, and incident-record retention. Billing is outside the pilot; Stripe is anticipated for a later SaaS release.
6. **Multiple workplaces/incidents:** Employees may be associated with several workplaces. For a given incident, the relevant geofence is the incident workplace perimeter. The MVP permits only one active incident per workplace; overlapping incidents do not need support.
7. **Delivery:** The service pings each target device every five seconds while an incident is active and the device has not acknowledged receipt. The initial target is delivery acknowledgement within one minute for reachable devices. Device acknowledgement means delivered and is distinct from employee acknowledgement.
8. **Pilot identity and records:** Use a third-party profile/authentication and session-management provider. Employee identity uses name and work email. Customers set a retention period to match policy. Each incident creates a real-time record of incident details, responses and times, and people not accounted for. Completed audits are reviewable in the customer portal. Automatic employee removal through HR/API integration is deferred.
9. **Platforms:** Android 13 or later for employee phones and Windows 10 for work devices. The target is the initial Windows 10 release if technically feasible; validate compatibility during technical discovery.
10. **Critical-device popup:** A configured critical device shows a bottom-right popup with a cancel button. Canceling records the device notification as **Seen**; it does not resolve the incident or mark an employee safe.
11. **Unavailable access/delivery:** If an employee denies location or notification access, record **Denied access** in the incident-linked employee record. If their device remains unreachable through retries, record **Unreachable**. These states do not mean safe or acknowledged.
12. **Retention:** Customers configure incident retention to meet company policy and applicable data-protection rules for their region; records are retained as long as practically permitted under that policy and law.
13. **Authentication:** Use a third-party profile/authentication and session-management provider, with provider selection deferred to technical discovery. Pilot identity uses name and work email.
14. **Billing:** Billing is not needed for the pilot. Stripe is the anticipated provider for a later release.

## 7. Remaining implementation questions

These are implementation details rather than unresolved product direction:

- What location freshness window should apply, and how should stale or inaccurate GPS be shown? Opening the incident notification triggers an immediate location read; five-second refreshes continue only while the incident screen is visible. The MVP perimeter shape is a rectangular box.
- Which third-party identity/profile and session-management provider should be selected during technical discovery?
- What exact data is deleted or retained when an incident reaches its policy retention limit, including backups and derived analytics, while meeting applicable regional rules?
- Can Windows 10 initial release be supported by the work-device implementation and deployment method?
- What is the technical behavior when Android notification permission is denied, and how will **Denied access** and **Unreachable** be surfaced in employee incident records and manifests?
