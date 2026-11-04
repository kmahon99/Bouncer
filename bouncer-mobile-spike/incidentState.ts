export type PresenceState = 'on_site' | 'off_site' | 'unknown';
export type LocationFreshness = 'current' | 'stale' | 'unavailable';
export type PerimeterResult = PresenceState;
export type IncidentLifecycle = 'active' | 'resolved' | 'aborted';
export type AccountabilityOutcome =
  | 'follow_up_required'
  | 'employee_reported_safe'
  | 'manager_marked_safe'
  | 'manager_exception';

export type SafeReportResult =
  | { status: 'employee_reported_safe' }
  | {
      status: 'not_confirmed';
      reason:
        | 'incident_not_active'
        | 'acknowledgement_required'
        | 'location_unavailable'
        | 'location_stale'
        | 'outside_assembly_area'
        | 'location_uncertain';
    };

export interface ResolutionParticipant {
  accountability: AccountabilityOutcome;
  latestPhonePresence?: PresenceState;
}

export interface ResolutionReadiness {
  canResolve: boolean;
  blockers: Array<'people_unaccounted' | 'hazard_not_cleared'>;
}

export interface IncidentRosterState {
  presence: PresenceState;
  location: LocationFreshness;
  accountability: AccountabilityOutcome;
  manualFollowUpRequired: boolean;
  acknowledgementLabel: string;
}

export function classifyLocationFreshness(
  lastReportAtMs: number | null,
  nowMs: number,
  expectedIntervalMs: number,
  missedIntervals = 3,
): LocationFreshness {
  if (lastReportAtMs === null || !Number.isFinite(lastReportAtMs)) {
    return 'unavailable';
  }

  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expectedIntervalMs) ||
    expectedIntervalMs <= 0 ||
    !Number.isFinite(missedIntervals) ||
    missedIntervals <= 0
  ) {
    return 'stale';
  }

  const ageMs = nowMs - lastReportAtMs;
  if (ageMs < 0) {
    return 'stale';
  }

  return ageMs <= expectedIntervalMs * missedIntervals ? 'current' : 'stale';
}

export function classifyPerimeter(
  distanceFromSiteCenterMeters: number,
  accuracyMeters: number | null,
  siteRadiusMeters: number,
): PerimeterResult {
  if (
    !Number.isFinite(distanceFromSiteCenterMeters) ||
    distanceFromSiteCenterMeters < 0 ||
    accuracyMeters === null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    !Number.isFinite(siteRadiusMeters) ||
    siteRadiusMeters <= 0
  ) {
    return 'unknown';
  }

  if (distanceFromSiteCenterMeters + accuracyMeters <= siteRadiusMeters) {
    return 'on_site';
  }

  if (distanceFromSiteCenterMeters - accuracyMeters > siteRadiusMeters) {
    return 'off_site';
  }

  return 'unknown';
}

export function getIncidentRosterState(
  presence: PresenceState,
  acknowledged: boolean,
  locationPermissionGranted: boolean,
  reportedLocation: LocationFreshness,
  accountability: AccountabilityOutcome = 'follow_up_required',
): IncidentRosterState {
  const location = locationPermissionGranted
    ? reportedLocation
    : 'unavailable';

  const acknowledgementLabel = !acknowledged
    ? 'Not acknowledged'
    : location === 'unavailable'
      ? 'Acknowledged — location unavailable'
      : location === 'stale'
        ? 'Acknowledged — location stale'
        : 'Acknowledged';

  return {
    // Location loss changes location freshness, never the existing presence evidence.
    presence,
    location,
    accountability,
    // Phone presence is evidence only: it never clears the accountability action.
    manualFollowUpRequired: accountability === 'follow_up_required',
    acknowledgementLabel,
  };
}

export function evaluateAssemblySafeReport(input: {
  incidentStatus: IncidentLifecycle;
  acknowledged: boolean;
  locationPermissionGranted: boolean;
  locationFreshness: LocationFreshness;
  assemblyAreaResult: PresenceState;
}): SafeReportResult {
  if (input.incidentStatus !== 'active') {
    return { status: 'not_confirmed', reason: 'incident_not_active' };
  }
  if (!input.acknowledged) {
    return { status: 'not_confirmed', reason: 'acknowledgement_required' };
  }
  if (!input.locationPermissionGranted || input.locationFreshness === 'unavailable') {
    return { status: 'not_confirmed', reason: 'location_unavailable' };
  }
  if (input.locationFreshness !== 'current') {
    return { status: 'not_confirmed', reason: 'location_stale' };
  }
  if (input.assemblyAreaResult === 'off_site') {
    return { status: 'not_confirmed', reason: 'outside_assembly_area' };
  }
  if (input.assemblyAreaResult !== 'on_site') {
    return { status: 'not_confirmed', reason: 'location_uncertain' };
  }
  return { status: 'employee_reported_safe' };
}

export function getResolutionReadiness(
  participants: ResolutionParticipant[],
  hazardClearedByManager: boolean,
): ResolutionReadiness {
  const blockers: ResolutionReadiness['blockers'] = [];
  if (participants.some((person) => person.accountability === 'follow_up_required')) {
    blockers.push('people_unaccounted');
  }
  if (!hazardClearedByManager) {
    blockers.push('hazard_not_cleared');
  }
  return { canResolve: blockers.length === 0, blockers };
}
