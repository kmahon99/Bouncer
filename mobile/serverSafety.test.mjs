import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';

async function unusedPort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('local incident service records only accepted employee safe reports and exposes the outcome', async (t) => {
  const port = await unusedPort();
  const serverUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    '--import', pathToFileURL(fileURLToPath(new URL('./mockPushForTest.mjs', import.meta.url))).href,
    fileURLToPath(new URL('./dev-server.mjs', import.meta.url)),
  ], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let startupError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { startupError += chunk; });
  t.after(() => child.kill());

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await fetch(`${serverUrl}/health`);
      if (health.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `local API should start. ${startupError}`);

  const employeeDevice = 'ExponentPushToken[employee-one]';
  const registerResponse = await fetch(`${serverUrl}/api/devices/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: employeeDevice, platform: 'android', deviceName: 'test phone' }),
  });
  assert.equal(registerResponse.status, 201);

  const center = { latitude: 53.3498, longitude: -6.2603 };
  const createResponse = await fetch(`${serverUrl}/api/incidents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test evacuation', protocol: 'Go to the assembly point.',
      assemblyArea: { ...center, radiusMeters: 20 },
    }),
  });
  assert.equal(createResponse.status, 201);
  const { incidentId } = await createResponse.json();

  const acknowledgeResponse = await fetch(`${serverUrl}/api/incidents/${incidentId}/acknowledge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: employeeDevice, acknowledgedAt: new Date().toISOString() }),
  });
  assert.equal(acknowledgeResponse.status, 200);

  const reportResponse = await fetch(`${serverUrl}/api/incidents/${incidentId}/report-safe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device: employeeDevice, locationPermissionGranted: true,
      location: { ...center, accuracyMeters: 4, capturedAt: new Date().toISOString() },
    }),
  });
  const reportBody = await reportResponse.json();
  assert.equal(reportBody.report.status, 'employee_reported_safe');
  assert.equal(typeof reportBody.report.reportedAt, 'string');

  const manifestResponse = await fetch(`${serverUrl}/api/incidents/${incidentId}/manifest`);
  const manifestBody = await manifestResponse.json();
  assert.equal(manifestBody.manifest[0].safetyReport.status, 'employee_reported_safe');
  assert.equal('latitude' in manifestBody.manifest[0].safetyReport, false);

  const secondDevice = 'ExponentPushToken[employee-two]';
  await fetch(`${serverUrl}/api/devices/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: secondDevice, platform: 'android', deviceName: 'second test phone' }),
  });
  await fetch(`${serverUrl}/api/incidents/${incidentId}/acknowledge`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: secondDevice, acknowledgedAt: new Date().toISOString() }),
  });
  const outsideResponse = await fetch(`${serverUrl}/api/incidents/${incidentId}/report-safe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device: secondDevice, locationPermissionGranted: true,
      location: { latitude: 53.351, longitude: -6.2603, accuracyMeters: 4, capturedAt: new Date().toISOString() },
    }),
  });
  const outsideBody = await outsideResponse.json();
  assert.deepEqual(
    { status: outsideBody.report.status, reason: outsideBody.report.reason },
    { status: 'not_confirmed', reason: 'outside_assembly_area' },
  );

  const noPermissionResponse = await fetch(`${serverUrl}/api/incidents/${incidentId}/report-safe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: secondDevice, locationPermissionGranted: false, location: null }),
  });
  const noPermissionBody = await noPermissionResponse.json();
  assert.deepEqual(
    { status: noPermissionBody.report.status, reason: noPermissionBody.report.reason },
    { status: 'not_confirmed', reason: 'location_unavailable' },
  );
});
