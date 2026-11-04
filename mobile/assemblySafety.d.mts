export interface AssemblyArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface AssemblyReportInput {
  incidentActive: boolean;
  acknowledged: boolean;
  locationPermissionGranted: boolean;
  locationTimestampMs: number;
  nowMs: number;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  assemblyArea: AssemblyArea | null;
}

export type AssemblyReportResult =
  | { accepted: true; distanceMeters: number }
  | {
      accepted: false;
      reason:
        | 'incident_not_active'
        | 'acknowledgement_required'
        | 'location_unavailable'
        | 'assembly_area_unconfigured'
        | 'location_stale'
        | 'location_uncertain'
        | 'outside_assembly_area';
      distanceMeters?: number;
    };

export const MAX_REPORT_AGE_MS: number;
export function distanceBetweenMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number;
export function evaluateAssemblyAreaReport(input: AssemblyReportInput): AssemblyReportResult;
