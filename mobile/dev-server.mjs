// Local-only Bouncer spike server. Data is in memory and is lost on restart.
// This intentionally has no authentication and must not be exposed to the internet.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT ?? 3000);
const devices = new Map();
const incidents = new Map();
const employees = [
  { id: 'employee-001', name: 'Employee 001', email: 'employee001@example.test', active: true },
  { id: 'employee-002', name: 'Employee 002', email: 'employee002@example.test', active: true },
  { id: 'employee-003', name: 'Employee 003', email: 'employee003@example.test', active: true },
  { id: 'employee-004', name: 'Employee 004', email: 'employee004@example.test', active: true },
];

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, 200, { ok: true, registeredDevices: devices.size });
    }
    if (request.method === 'GET' && url.pathname === '/admin') {
      return html(response, 200, await readFile(new URL('./admin.html', import.meta.url)));
    }
    if (request.method === 'GET' && url.pathname === '/api/employees') {
      return json(response, 200, { employees: employees.filter((employee) => employee.active) });
    }
    if (request.method === 'POST' && url.pathname === '/api/devices/register') {
      const body = await readJson(request);
      if (typeof body.token !== 'string' || !body.token.startsWith('ExponentPushToken[')) {
        return json(response, 400, { error: 'A valid Expo push token is required.' });
      }
      const existingDevice = devices.get(body.token);
      const employee = existingDevice?.employeeId
        ? employees.find((candidate) => candidate.id === existingDevice.employeeId)
        : employees.find((candidate) => ![...devices.values()].some((device) => device.employeeId === candidate.id));
      devices.set(body.token, { token: body.token, employeeId: employee?.id ?? null, platform: body.platform ?? 'unknown', deviceName: body.deviceName ?? 'device', registeredAt: new Date().toISOString() });
      return json(response, 201, { ok: true });
    }
    if (request.method === 'POST' && (url.pathname === '/api/incidents' || url.pathname === '/api/incidents/test')) {
      const body = url.pathname.endsWith('/test') ? {} : await readJson(request);
      const title = url.pathname.endsWith('/test') ? 'Fire drill' : body.title;
      const protocol = url.pathname.endsWith('/test')
        ? 'Leave by the nearest safe exit. Go to the north car park assembly point. Follow workplace instructions and do not re-enter until the incident manager says it is safe.'
        : body.protocol;
      if (typeof title !== 'string' || !title.trim() || typeof protocol !== 'string' || !protocol.trim()) {
        return json(response, 400, { error: 'Incident title and response instructions are required.' });
      }
      if (devices.size === 0) return json(response, 409, { error: 'No device has registered a push token yet.' });
      if ([...incidents.values()].some((incident) => incident.status === 'active')) {
        return json(response, 409, { error: 'Resolve the active incident before declaring another.' });
      }
      const incident = createIncident({ title: title.trim(), protocol: protocol.trim(), employees });
      const messages = [...devices.values()].map(({ token }) => ({
        to: token,
        title: 'Bouncer: active incident',
        body: `${incident.title} is active. Open Bouncer to acknowledge and view the instructions.`,
        sound: 'default',
        priority: 'high',
        channelId: 'incidents',
        data: { action: 'incident', incidentId: incident.id, title: incident.title, protocol: incident.protocol },
      }));
      const pushResult = await sendPush(messages);
      if (!pushResult.ok) return json(response, 502, { error: 'Expo Push API rejected the request.', details: pushResult.details });
      incidents.set(incident.id, incident);
      return json(response, 201, { ok: true, incidentId: incident.id, sent: messages.length, expo: pushResult.details });
    }
    const resolveMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/resolve$/);
    if (request.method === 'POST' && resolveMatch) {
      const id = decodeURIComponent(resolveMatch[1]);
      const incident = incidents.get(id);
      if (!incident) return json(response, 404, { error: 'Incident was not found.' });
      if (incident.status !== 'active') return json(response, 409, { error: 'Incident is already resolved.' });
      if (devices.size === 0) return json(response, 409, { error: 'There are no registered devices to notify.' });
      const messages = [...devices.values()].map(({ token }) => ({
        to: token,
        title: 'Bouncer: incident resolved',
        body: `${incident.title} has been resolved. You may close Bouncer.`,
        sound: 'default',
        priority: 'high',
        channelId: 'incidents',
        data: { action: 'resolved', incidentId: id, title: incident.title },
      }));
      const pushResult = await sendPush(messages);
      if (!pushResult.ok) return json(response, 502, { error: 'Could not send the resolution notification.', details: pushResult.details });
      incident.status = 'resolved';
      incident.resolvedAt = new Date().toISOString();
      return json(response, 200, { ok: true, incidentId: id, resolvedAt: incident.resolvedAt, sent: messages.length, expo: pushResult.details });
    }
    const ackMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/acknowledge$/);
    if (request.method === 'POST' && ackMatch) {
      const body = await readJson(request);
      const id = decodeURIComponent(ackMatch[1]);
      let incident = incidents.get(id);
      if (!incident) {
        // Keep local notifications and app-side smoke checks useful as well.
        incident = { id, title: 'Active incident', protocol: '', declaredAt: null, acknowledgements: [] };
        incidents.set(id, incident);
      }
      if (incident.status === 'resolved') return json(response, 409, { error: 'This incident has already been resolved.' });
      const device = devices.get(body.device);
      const record = { device: body.device ?? null, employeeId: device?.employeeId ?? null, acknowledgedAt: body.acknowledgedAt ?? new Date().toISOString(), locationStatus: body.locationStatus ?? 'unavailable', location: body.location ?? null };
      const existing = incident.acknowledgements.findIndex((entry) => entry.device === record.device);
      if (existing >= 0) incident.acknowledgements[existing] = record;
      else incident.acknowledgements.push(record);
      const employeeResponse = incident.employees?.find((entry) => entry.employeeId === record.employeeId);
      if (employeeResponse) employeeResponse.response = 'acknowledged';
      return json(response, 200, { ok: true, incidentId: id, acknowledgement: record });
    }
    const locationMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/location$/);
    if (request.method === 'POST' && locationMatch) {
      const body = await readJson(request);
      const id = decodeURIComponent(locationMatch[1]);
      const incident = incidents.get(id);
      if (!incident) return json(response, 404, { error: 'Incident was not found.' });
      const device = body.device ?? null;
      const record = incident.acknowledgements.find((entry) => entry.device === device);
      if (!record) return json(response, 409, { error: 'Acknowledge the incident before updating location.' });
      record.locationStatus = body.locationStatus ?? 'unavailable';
      record.location = body.location ?? null;
      record.locationUpdatedAt = new Date().toISOString();
      const employeeResponse = incident.employees?.find((entry) => entry.employeeId === record.employeeId);
      if (employeeResponse) employeeResponse.presence = record.locationStatus === 'available' ? 'location-received' : 'manual-check';
      return json(response, 200, { ok: true, incidentId: id, locationStatus: record.locationStatus });
    }
    const safeMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/manifest\/([^/]+)\/safe$/);
    if (request.method === 'POST' && safeMatch) {
      const id = decodeURIComponent(safeMatch[1]);
      const employeeId = decodeURIComponent(safeMatch[2]);
      const incident = incidents.get(id);
      if (!incident) return json(response, 404, { error: 'Incident was not found.' });
      const entry = incident.employees?.find((candidate) => candidate.employeeId === employeeId);
      if (!entry) return json(response, 404, { error: 'Employee was not found on this incident manifest.' });
      entry.safety = 'safe';
      entry.safetyUpdatedAt = new Date().toISOString();
      return json(response, 200, { ok: true, employee: entry });
    }
    const manifestMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/manifest$/);
    if (request.method === 'GET' && manifestMatch) {
      const incident = incidents.get(decodeURIComponent(manifestMatch[1]));
      if (!incident) return json(response, 404, { error: 'Incident was not found.' });
      const manifest = (incident.employees ?? []).map((entry) => {
        const employee = employees.find((candidate) => candidate.id === entry.employeeId);
        const acknowledgement = incident.acknowledgements.find((candidate) => candidate.employeeId === entry.employeeId);
        return { ...employee, ...entry, acknowledgedAt: acknowledgement?.acknowledgedAt ?? null };
      });
      return json(response, 200, { incident: { id: incident.id, title: incident.title, declaredAt: incident.declaredAt, status: incident.status, resolvedAt: incident.resolvedAt ?? null }, manifest });
    }
    if (request.method === 'GET' && url.pathname === '/api/incidents') {
      return json(response, 200, { incidents: [...incidents.values()] });
    }
    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: error instanceof Error ? error.message : 'Unexpected server error.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Bouncer spike server listening on http://0.0.0.0:${port}`);
  console.log('Local prototype only: unauthenticated, in-memory, and not for production use.');
});

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function html(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(value);
}

async function readJson(request) {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function createIncident({ title, protocol, employees }) {
  const id = `incident-${Date.now()}`;
  return {
    id,
    title,
    protocol,
    declaredAt: new Date().toISOString(),
    status: 'active',
    employees: employees.filter((employee) => employee.active).map((employee) => ({ employeeId: employee.id, response: 'unacknowledged', presence: 'manual-check', safety: 'unconfirmed', safetyUpdatedAt: null })),
    acknowledgements: [],
  };
}

async function sendPush(messages) {
  try {
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const details = await pushResponse.json();
    return { ok: pushResponse.ok, details };
  } catch (error) {
    return { ok: false, details: { message: error instanceof Error ? error.message : 'Push request failed.' } };
  }
}
