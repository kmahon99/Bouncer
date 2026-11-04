import {
  classifyLocationFreshness,
  classifyPerimeter,
  evaluateAssemblySafeReport,
  getResolutionReadiness,
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
      accountability: 'follow_up_required',
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
      accountability: 'follow_up_required',
      manualFollowUpRequired: true,
      acknowledgementLabel: 'Acknowledged — location unavailable',
    });
  });

  it('does not treat an off-site phone report as an automatic accountability exemption', () => {
    expect(
      getIncidentRosterState('off_site', true, true, 'current'),
    ).toMatchObject({
      presence: 'off_site',
      accountability: 'follow_up_required',
      manualFollowUpRequired: true,
    });
  });

  it('shows employee-reported safe separately from manager-confirmed safe', () => {
    expect(
      getIncidentRosterState(
        'on_site',
        true,
        true,
        'current',
        'employee_reported_safe',
      ),
    ).toMatchObject({
      accountability: 'employee_reported_safe',
      manualFollowUpRequired: false,
    });
  });
});

describe('evaluateAssemblySafeReport', () => {
  const eligibleReport = {
    incidentStatus: 'active' as const,
    acknowledged: true,
    locationPermissionGranted: true,
    locationFreshness: 'current' as const,
    assemblyAreaResult: 'on_site' as const,
  };

  it('accepts an explicit report only with a fresh location fix inside the assembly area', () => {
    expect(evaluateAssemblySafeReport(eligibleReport)).toEqual({
      status: 'employee_reported_safe',
    });
  });

  it('does not accept reports outside the assembly area or with uncertain bounds', () => {
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, assemblyAreaResult: 'off_site' }),
    ).toEqual({ status: 'not_confirmed', reason: 'outside_assembly_area' });
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, assemblyAreaResult: 'unknown' }),
    ).toEqual({ status: 'not_confirmed', reason: 'location_uncertain' });
  });

  it('does not accept a report before acknowledgement or when location is unavailable/stale', () => {
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, acknowledged: false }),
    ).toEqual({ status: 'not_confirmed', reason: 'acknowledgement_required' });
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, locationPermissionGranted: false }),
    ).toEqual({ status: 'not_confirmed', reason: 'location_unavailable' });
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, locationFreshness: 'stale' }),
    ).toEqual({ status: 'not_confirmed', reason: 'location_stale' });
  });

  it('does not accept a report after the incident has ended', () => {
    expect(
      evaluateAssemblySafeReport({ ...eligibleReport, incidentStatus: 'aborted' }),
    ).toEqual({ status: 'not_confirmed', reason: 'incident_not_active' });
  });
});

describe('getResolutionReadiness', () => {
  it('requires the manager hazard-clear decision even when everyone has an outcome', () => {
    expect(
      getResolutionReadiness(
        [{ accountability: 'employee_reported_safe' }, { accountability: 'manager_marked_safe' }],
        false,
      ),
    ).toEqual({ canResolve: false, blockers: ['hazard_not_cleared'] });
  });

  it('keeps a reported-off-site person in follow-up until a manager records an outcome', () => {
    expect(
      getResolutionReadiness(
        [{ accountability: 'follow_up_required', latestPhonePresence: 'off_site' }],
        true,
      ),
    ).toEqual({ canResolve: false, blockers: ['people_unaccounted'] });
  });

  it('allows resolution when all roster outcomes are recorded and the hazard is clear', () => {
    expect(
      getResolutionReadiness(
        [
          { accountability: 'employee_reported_safe' },
          { accountability: 'manager_marked_safe' },
          { accountability: 'manager_exception' },
        ],
        true,
      ),
    ).toEqual({ canResolve: true, blockers: [] });
  });
});
