# Bouncer agile workflow

## Purpose

Deliver the office evacuation product in small, reviewable increments. Each increment should reduce a known user problem, have observable acceptance criteria, and leave the product in a safe, understandable state. The workflow is intentionally lightweight and can be used by one developer or a small team.

## Work tracking

The ordered backlog is in [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md). It is the source of truth for planned work and current status. Use these statuses:

- **Proposed** — captured, but not refined enough to start.
- **Ready** — meets the Definition of Ready and may be selected.
- **In progress** — actively being implemented; keep work in progress to one story per contributor where practical.
- **Review** — implementation and criteria are complete; awaiting review.
- **Done** — accepted criteria are met, required checks pass, and the change is integrated.
- **Blocked** — cannot proceed; record the dependency and the decision or action needed.

Do not estimate large epics as if they were executable tasks. Break work into independently reviewable stories, then split stories further when they span multiple outcomes or cannot reasonably be reviewed as one change. Use relative sizing only if it helps ordering; avoid false precision in time estimates.

## Delivery cycle

1. **Refine:** Confirm the user, outcome, scope, risks, dependencies, and acceptance criteria. Record material product decisions and unresolved questions.
2. **Select:** Choose the highest-priority Ready story whose dependencies are met. Prefer a vertical slice that can be demonstrated and reviewed.
3. **Plan:** Identify the smallest design and implementation steps, including failure cases, authorization boundaries, telemetry/audit needs, and test levels.
4. **Implement test-first:** For behavior changes, write a failing test for one acceptance behavior, implement the minimum change to pass it, then refactor while keeping tests green. Repeat for the next behavior. Do not write tests that merely restate implementation details.
5. **Verify:** Run relevant automated checks and manual checks specified by the story. Review security, privacy, accessibility, failure handling, logs, and user-facing uncertainty for relevant changes.
6. **Review and learn:** Compare the result to acceptance criteria, capture defects and follow-up work, update backlog status, and record decisions. Do not mark a story Done while a critical criterion is unmet.

## Definition of Ready

A story is Ready when it has:

- A user and a concrete outcome.
- Bounded scope and explicit exclusions where needed.
- Acceptance criteria written as observable behavior, including relevant failure paths.
- Identified dependencies and material decisions resolved or explicitly accepted as assumptions.
- Relevant privacy, security, safety, accessibility, and operational concerns identified.
- A test approach that covers the behavior at the appropriate level.

For location, incident lifecycle, device restrictions, identity, or customer data, the story must also state what data is collected, who can access or change it, how stale/unavailable state is represented, and what happens on failure.

## Definition of Done

A story is Done when:

- All acceptance criteria pass and the change is reviewable.
- Tests were written test-first for new or changed behavior, and relevant automated tests pass. Any justified exception is documented in the story.
- Relevant integration, security, privacy, accessibility, recovery, and failure-path checks are complete.
- No known critical defect or unsafe ambiguity remains in the story's scope.
- Documentation and user-visible language match actual behavior; no unsupported security, safety, or compliance claims are made.
- The backlog and consequential decision records are updated.

## TDD guidance

- Start at the narrowest useful level: domain/unit tests for rules and transitions, integration tests for persistence and HTTP/SignalR authorization and scoping, and UI/platform tests for Windows behavior where feasible.
- Prefer deterministic tests. Inject clocks, location sources, device transports, and persistence interfaces rather than waiting on real time, GPS, networks, or devices.
- For incident and accountability rules, cover both allowed and rejected transitions, duplicate and stale events, authorization, multi-tenant/site isolation, disconnected clients, and manual exceptions.
- For geofence decisions, test boundary points, reported accuracy, stale timestamps, missing fixes, and coordinate conversion. A test result must not imply GPS proves physical safety.
- Keep end-to-end tests for a small number of critical flows; do not make every rule depend on a live service or UI automation.
- Tests are evidence of specified behavior, not proof of real-world emergency suitability. Platform and operational exercises remain necessary.

## Review checklist

For every story, reviewers should ask:

- Does the implementation satisfy each acceptance criterion and reject invalid input/state?
- Is every consequential action authenticated, authorized, scoped, and auditable?
- Are uncertain, stale, missing, and failed signals shown honestly?
- Does a network, process, device, or permission failure have a clear state and recovery path?
- Is personal data minimized and protected through collection, access, logs, and retention?
- Are users told what the system can and cannot establish?
- Are tests deterministic and focused on user-visible behavior and security boundaries?

## Cadence and reporting

Use short iterations selected by outcome rather than fixed calendar commitments. At the start, name the goal and selected stories. At the end, report what is Done, what remains, checks run and their results, known risks, and the next highest-priority work. Do not claim an iteration succeeded based only on code being written.

## Story template

```markdown
### [ID] Story title
- Status: Proposed | Ready | In progress | Review | Done | Blocked
- Priority: P0 | P1 | P2 | P3
- Epic: ...
- User / outcome: ...
- Dependencies: ...
- Assumptions / decisions: ...

As a [user], I want [capability], so that [outcome].

Acceptance criteria:
- Given ... When ... Then ...

Failure and security cases:
- ...

Test plan:
- Unit/domain: ...
- Integration: ...
- UI/platform/manual: ...
```
