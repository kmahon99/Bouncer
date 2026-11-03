import { PerimeterResult } from './incidentState';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceBetweenMeters(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function classifyPerimeter(
  distanceMeters: number,
  accuracyMeters: number | null,
  radiusMeters: number,
): PerimeterResult {
  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    accuracyMeters === null ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  ) {
    return 'unknown';
  }
  if (distanceMeters + accuracyMeters <= radiusMeters) return 'on_site';
  if (distanceMeters - accuracyMeters > radiusMeters) return 'off_site';
  return 'unknown';
}

/** Only post-acknowledgement incident reports may include coordinate payloads. */
export function shouldTransmitCoordinates(incidentActive: boolean, acknowledged: boolean): boolean {
  return incidentActive && acknowledged;
}
