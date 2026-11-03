import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { shouldTransmitCoordinates } from './locationPolicy';

const TASK_NAME = 'bouncer-incident-location-spike';
const INCIDENT_ACTIVE_KEY = 'bouncer.spike.incident.active';
const ACKNOWLEDGED_KEY = 'bouncer.spike.incident.acknowledged';
const METADATA_KEY = 'bouncer.spike.location.metadata';

export interface LocationMetadata {
  lastReportAtMs: number | null;
  accuracyMeters: number | null;
  reportCount: number;
}

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const incidentActive = (await AsyncStorage.getItem(INCIDENT_ACTIVE_KEY)) === 'true';
  const acknowledged = (await AsyncStorage.getItem(ACKNOWLEDGED_KEY)) === 'true';
  if (!shouldTransmitCoordinates(incidentActive, acknowledged)) return;
  const latest = data?.locations?.at(-1);
  if (!latest) return;

  // Intentionally discard the coordinate payload. The spike tests native cadence/privacy metadata only.
  const previous = await readLocationMetadata();
  await AsyncStorage.setItem(METADATA_KEY, JSON.stringify({
    lastReportAtMs: latest.timestamp,
    accuracyMeters: latest.coords.accuracy,
    reportCount: previous.reportCount + 1,
  } satisfies LocationMetadata));
});

export async function readLocationMetadata(): Promise<LocationMetadata> {
  const raw = await AsyncStorage.getItem(METADATA_KEY);
  if (!raw) return { lastReportAtMs: null, accuracyMeters: null, reportCount: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<LocationMetadata>;
    return {
      lastReportAtMs: typeof parsed.lastReportAtMs === 'number' ? parsed.lastReportAtMs : null,
      accuracyMeters: typeof parsed.accuracyMeters === 'number' ? parsed.accuracyMeters : null,
      reportCount: typeof parsed.reportCount === 'number' ? parsed.reportCount : 0,
    };
  } catch {
    return { lastReportAtMs: null, accuracyMeters: null, reportCount: 0 };
  }
}

export async function acknowledgeIncident(): Promise<void> {
  await AsyncStorage.multiSet([[INCIDENT_ACTIVE_KEY, 'true'], [ACKNOWLEDGED_KEY, 'true']]);
}

export async function startIncidentLocation(background: boolean): Promise<void> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) throw new Error('Foreground location permission is unavailable');
  if (background) {
    const permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) throw new Error('Background location permission is unavailable');
  }

  if (!(await TaskManager.isTaskDefined(TASK_NAME))) throw new Error('Location task is not registered');
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Bouncer incident reporting',
      notificationBody: 'Location reporting is active for this test incident.',
      notificationColor: '#173a5e',
    },
  });
}

export async function stopIncidentLocation(): Promise<void> {
  await AsyncStorage.multiSet([[INCIDENT_ACTIVE_KEY, 'false'], [ACKNOWLEDGED_KEY, 'false']]);
  if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  await AsyncStorage.removeItem(METADATA_KEY);
}
