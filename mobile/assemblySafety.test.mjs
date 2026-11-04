import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAssemblyAreaReport } from './assemblySafety.mjs';

const input = {
  incidentActive: true,
  acknowledged: true,
  locationPermissionGranted: true,
  locationTimestampMs: 10_000,
  nowMs: 10_500,
  latitude: 53.3498,
  longitude: -6.2603,
  accuracyMeters: 4,
  assemblyArea: { latitude: 53.3498, longitude: -6.2603, radiusMeters: 20 },
};

test('accepts Report safe when the fresh accuracy bounds fit inside the assembly area', () => {
  assert.deepEqual(evaluateAssemblyAreaReport(input), { accepted: true, distanceMeters: 0 });
});

test('does not accept a location outside the assembly area', () => {
  assert.equal(
    evaluateAssemblyAreaReport({ ...input, latitude: 53.3508 }).reason,
    'outside_assembly_area',
  );
});

test('does not accept an accuracy circle that overlaps the assembly boundary', () => {
  assert.equal(
    evaluateAssemblyAreaReport({ ...input, accuracyMeters: 25 }).reason,
    'location_uncertain',
  );
});

test('requires permission, acknowledgement, active incident, and fresh location', () => {
  assert.equal(evaluateAssemblyAreaReport({ ...input, locationPermissionGranted: false }).reason, 'location_unavailable');
  assert.equal(evaluateAssemblyAreaReport({ ...input, acknowledged: false }).reason, 'acknowledgement_required');
  assert.equal(evaluateAssemblyAreaReport({ ...input, incidentActive: false }).reason, 'incident_not_active');
  assert.equal(evaluateAssemblyAreaReport({ ...input, locationTimestampMs: 0, nowMs: 16_000 }).reason, 'location_stale');
});

test('requires configured assembly area and valid location accuracy', () => {
  assert.equal(evaluateAssemblyAreaReport({ ...input, assemblyArea: null }).reason, 'assembly_area_unconfigured');
  assert.equal(evaluateAssemblyAreaReport({ ...input, accuracyMeters: null }).reason, 'location_uncertain');
});
