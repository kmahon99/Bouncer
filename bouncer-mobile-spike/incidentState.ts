export type PresenceState = 'on_site' | 'off_site' | 'unknown';
export type LocationFreshness = 'current' | 'stale' | 'unavailable';
export type PerimeterResult = PresenceState;

export interface IncidentRosterState {
  presence: PresenceState;
  location: LocationFreshness;
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
    manualFollowUpRequired:
      presence === 'unknown' || (presence === 'on_site' && location !== 'current'),
    acknowledgementLabel,
  };
}
