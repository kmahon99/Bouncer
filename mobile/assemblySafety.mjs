const EARTH_RADIUS_METERS = 6_371_000;
export const MAX_REPORT_AGE_MS = 15_000;

export function distanceBetweenMeters(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function evaluateAssemblyAreaReport(input) {
  if (!input.incidentActive) return { accepted: false, reason: 'incident_not_active' };
  if (!input.acknowledged) return { accepted: false, reason: 'acknowledgement_required' };
  if (!input.locationPermissionGranted) return { accepted: false, reason: 'location_unavailable' };

  const area = input.assemblyArea;
  if (!area || !validCoordinates(area.latitude, area.longitude) ||
      !Number.isFinite(area.radiusMeters) || area.radiusMeters <= 0) {
    return { accepted: false, reason: 'assembly_area_unconfigured' };
  }

  if (!Number.isFinite(input.locationTimestampMs) || !Number.isFinite(input.nowMs) ||
      input.nowMs < input.locationTimestampMs || input.nowMs - input.locationTimestampMs > MAX_REPORT_AGE_MS) {
    return { accepted: false, reason: 'location_stale' };
  }
  if (!validCoordinates(input.latitude, input.longitude) ||
      !Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0) {
    return { accepted: false, reason: 'location_uncertain' };
  }

  const distanceMeters = distanceBetweenMeters(
    { latitude: input.latitude, longitude: input.longitude },
    { latitude: area.latitude, longitude: area.longitude },
  );
  if (distanceMeters + input.accuracyMeters <= area.radiusMeters) {
    return { accepted: true, distanceMeters };
  }
  if (distanceMeters - input.accuracyMeters > area.radiusMeters) {
    return { accepted: false, reason: 'outside_assembly_area', distanceMeters };
  }
  return { accepted: false, reason: 'location_uncertain', distanceMeters };
}
