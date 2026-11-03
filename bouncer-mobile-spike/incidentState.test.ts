import {
  classifyLocationFreshness,
  classifyPerimeter,
  getIncidentRosterState,
} from './incidentState';

describe('classifyLocationFreshness', () => {
  it('reports unavailable when the employee has never sent a location report', () => {
    expect(classifyLocationFreshness(null, 30_000, 5_000)).toBe('unavailable');
  });

  it('keeps a report current through three expected reporting intervals', () => {
    expect(classifyLocationFreshness(0, 15_000, 5_000)).toBe('current');
  });

  it('marks a report stale just after the freshness window', () => {
    expect(classifyLocationFreshness(0, 15_001, 5_000)).toBe('stale');
  });

  it('treats invalid intervals and future-dated reports as stale', () => {
    expect(classifyLocationFreshness(0, 1_000, 0)).toBe('stale');
    expect(classifyLocationFreshness(2_000, 1_000, 5_000)).toBe('stale');
  });
});

describe('classifyPerimeter', () => {
  it('reports on-site only when the accuracy circle is inside the site radius', () => {
    expect(classifyPerimeter(30, 5, 50)).toBe('on_site');
  });

  it('reports off-site only when the accuracy circle is outside the site radius', () => {
    expect(classifyPerimeter(80, 5, 50)).toBe('off_site');
  });

  it('reports unknown when location accuracy overlaps the site boundary', () => {
    expect(classifyPerimeter(48, 5, 50)).toBe('unknown');
    expect(classifyPerimeter(30, null, 50)).toBe('unknown');
  });
});

describe('getIncidentRosterState', () => {
  it('preserves on-site evidence and requests manual follow-up after location goes stale', () => {
    expect(
      getIncidentRosterState('on_site', true, true, 'stale'),
    ).toEqual({
      presence: 'on_site',
      location: 'stale',
      manualFollowUpRequired: true,
      acknowledgementLabel: 'Acknowledged — location stale',
    });
  });

  it('keeps acknowledgement independent from location permission', () => {
    expect(
      getIncidentRosterState('unknown', true, false, 'unavailable'),
    ).toEqual({
      presence: 'unknown',
      location: 'unavailable',
      manualFollowUpRequired: true,
      acknowledgementLabel: 'Acknowledged — location unavailable',
    });
  });
});
