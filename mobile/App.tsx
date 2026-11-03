import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type Incident = {
  id: string;
  title: string;
  protocol: string;
};

type LocationState = 'waiting' | 'permission' | 'reading' | 'ready' | 'denied' | 'error';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DEFAULT_PROTOCOL =
  'Leave by the nearest safe exit. Go to the north car park assembly point. Follow workplace instructions and do not re-enter until the incident manager says it is safe.';

export default function App() {
  const [apiUrl, setApiUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? '');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState('Notifications are not registered.');
  const [busy, setBusy] = useState(false);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [resolvedNotice, setResolvedNotice] = useState<string | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<number | null>(null);
  const [locationState, setLocationState] = useState<LocationState>('waiting');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const handledIncidentIds = useRef(new Set<string>());

  const normalizedApiUrl = apiUrl.trim().replace(/\/$/, '');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;

  const postLocationUpdate = useCallback(async (incidentId: string, locationPayload: Record<string, unknown> | null, status: string) => {
    try {
      if (!normalizedApiUrl) throw new Error('Enter the local server address first.');
      const response = await fetch(`${normalizedApiUrl}/api/incidents/${encodeURIComponent(incidentId)}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: pushToken, locationStatus: status, location: locationPayload }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (error) {
      setLocationError((current) => [current, `Location update could not reach the server: ${error instanceof Error ? error.message : 'network error'}`].filter(Boolean).join('\n'));
    }
  }, [normalizedApiUrl, pushToken]);

  const handleIncidentOpen = useCallback(async (incoming: Incident) => {
    setResolvedNotice(null);
    setIncident(incoming);
    setAcknowledgedAt(Date.now());
    setLocation(null);
    setLocationError(null);
    setLocationState('permission');

    try {
      if (!normalizedApiUrl) throw new Error('Enter the local server address first.');
      const response = await fetch(`${normalizedApiUrl}/api/incidents/${encodeURIComponent(incoming.id)}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedAt: new Date().toISOString(), device: pushToken, locationStatus: 'pending' }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (error) {
      setLocationError(`Acknowledgement could not reach the server: ${error instanceof Error ? error.message : 'network error'}`);
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationState('denied');
        await postLocationUpdate(incoming.id, null, 'denied');
      } else {
        const reading = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(reading);
        setLocationState('ready');
        const locationPayload = {
          latitude: reading.coords.latitude,
          longitude: reading.coords.longitude,
          accuracyMeters: reading.coords.accuracy,
          capturedAt: new Date(reading.timestamp).toISOString(),
        };
        await postLocationUpdate(incoming.id, locationPayload, 'available');
      }
    } catch (error) {
      setLocationState('error');
      setLocationError(error instanceof Error ? error.message : 'Location could not be read.');
      await postLocationUpdate(incoming.id, null, 'unavailable');
    }
  }, [normalizedApiUrl, postLocationUpdate, pushToken]);

  const openFromNotification = useCallback((response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (!data || typeof data.incidentId !== 'string') return;
    const incidentId = data.incidentId;
    if (data.action === 'resolved') {
      if (!incident || incident.id === incidentId) {
        setIncident(null);
        setResolvedNotice(`${typeof data.title === 'string' ? data.title : 'The incident'} has been resolved.`);
        setLocationState('waiting');
      }
      void Notifications.clearLastNotificationResponseAsync();
      return;
    }
    if (handledIncidentIds.current.has(incidentId)) return;
    handledIncidentIds.current.add(incidentId);
    void handleIncidentOpen({
      id: incidentId,
      title: typeof data.title === 'string' ? data.title : 'Active incident',
      protocol: typeof data.protocol === 'string' ? data.protocol : DEFAULT_PROTOCOL,
    });
    void Notifications.clearLastNotificationResponseAsync();
  }, [handleIncidentOpen, incident]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    void Notifications.getLastNotificationResponseAsync().then(openFromNotification);
    return () => subscription.remove();
  }, [openFromNotification]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (!data || data.action !== 'resolved' || typeof data.incidentId !== 'string' || incident?.id !== data.incidentId) return;
      setIncident(null);
      setResolvedNotice(`${typeof data.title === 'string' ? data.title : 'The incident'} has been resolved.`);
      setLocationState('waiting');
    });
    return () => subscription.remove();
  }, [incident]);

  const registerForPush = async () => {
    if (!normalizedApiUrl) {
      setPushStatus('Enter the local server address first.');
      return;
    }
    if (isRunningInExpoGo()) {
      setPushStatus('Remote notifications need the Bouncer development build. Expo Go on Android does not support remote push; install the development APK first.');
      return;
    }
    setBusy(true);
    setPushStatus('Setting up Android notifications…');
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('incidents', {
          name: 'Incident alerts',
          importance: AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#c92a2a',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Notification permission was not granted.');
      if (!projectId) throw new Error('EAS project ID is not configured yet. Complete the EAS setup step first.');
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      setPushToken(result.data);
      const response = await fetch(`${normalizedApiUrl}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.data, platform: Platform.OS, deviceName: Constants.deviceName ?? 'Android device' }),
      });
      if (!response.ok) throw new Error(`Device registration failed with HTTP ${response.status}.`);
      setPushStatus('Registered with the local prototype server.');
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : 'Push registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendTestIncident = async () => {
    if (!normalizedApiUrl) {
      setPushStatus('Enter the local server address first.');
      return;
    }
    setBusy(true);
    setPushStatus('Sending test incident…');
    try {
      const response = await fetch(`${normalizedApiUrl}/api/incidents/test`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Server returned ${response.status}`);
      setPushStatus(`Test incident sent to ${result.sent} registered device(s).`);
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : 'Could not send test incident.');
    } finally {
      setBusy(false);
    }
  };

  if (incident) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => setIncident(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>ACTIVE INCIDENT</Text>
          <Text style={styles.title}>{incident.title}</Text>
          <View style={styles.ackCard}>
            <View style={styles.indicator} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Acknowledged</Text>
              <Text style={styles.body}>{acknowledgedAt ? `Opened at ${new Date(acknowledgedAt).toLocaleTimeString()}` : ''}</Text>
            </View>
          </View>
          <View style={styles.protocolCard}>
            <Text style={styles.sectionLabel}>RESPONSE INSTRUCTIONS</Text>
            <Text style={styles.protocolTitle}>{incident.title}</Text>
            <Text style={styles.body}>{incident.protocol}</Text>
          </View>
          <View style={styles.locationCard}>
            <Text style={styles.sectionLabel}>LOCATION UPDATE</Text>
            <Text style={styles.locationTitle}>{locationStateLabel(locationState)}</Text>
            {location ? <Text style={styles.coordinate}>{location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}</Text> : null}
            {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
            {locationState === 'denied' ? <Text style={styles.body}>Manual check is required because location permission was denied.</Text> : null}
            <Text style={styles.privacyNote}>A one-time location reading is sent with the acknowledgement when permission is granted.</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ANDROID DEVICE SPIKE</Text>
        <Text style={styles.title}>Bouncer</Text>
        {resolvedNotice ? <View style={styles.resolvedCard}><Text style={styles.resolvedText}>{resolvedNotice}</Text></View> : null}
        <Text style={styles.description}>Register this Android device, send a test incident, and acknowledge it by opening the notification.</Text>
        <View style={styles.readyCard}>
          <View style={styles.indicator} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{pushToken ? 'Push token registered' : 'App is running'}</Text>
            <Text style={styles.body}>{pushStatus}</Text>
          </View>
        </View>
        <Text style={styles.sectionLabel}>LOCAL SERVER ADDRESS</Text>
        <TextInput accessibilityLabel="Local server address" autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={setApiUrl} style={styles.input} value={apiUrl} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={registerForPush} style={[styles.primaryButton, busy && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : pushToken ? 'Register device again' : 'Enable incident notifications'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !pushToken} onPress={sendTestIncident} style={[styles.secondaryButton, (busy || !pushToken) && styles.disabledButton]}>
          <Text style={styles.secondaryButtonText}>Send test incident to this device</Text>
        </Pressable>
        <Text style={styles.footerNote}>The development server must be running on this computer and reachable over the same Wi‑Fi network. This local prototype is not authenticated or suitable for production.</Text>
      </ScrollView>
    </View>
  );
}

function locationStateLabel(state: LocationState) {
  switch (state) {
    case 'permission': return 'Requesting location permission…';
    case 'reading': return 'Reading current location…';
    case 'ready': return 'Location reading sent with acknowledgement';
    case 'denied': return 'Denied access';
    case 'error': return 'Location unavailable';
    default: return 'Waiting for incident to open';
  }
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f5f7fa', flex: 1 },
  content: { alignSelf: 'center', flexGrow: 1, justifyContent: 'center', maxWidth: 480, padding: 24, width: '100%' },
  backButton: { alignSelf: 'flex-start', marginBottom: 28, paddingVertical: 8 },
  backButtonText: { color: '#385b7c', fontSize: 15, fontWeight: '600' },
  eyebrow: { color: '#58708b', fontSize: 12, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: '#14283f', fontSize: 38, fontWeight: '700', marginBottom: 10 },
  description: { color: '#52677c', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  readyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e1e8ef', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 18, padding: 18 },
  resolvedCard: { backgroundColor: '#e1f3e9', borderRadius: 12, marginBottom: 18, padding: 14 },
  resolvedText: { color: '#17603d', fontSize: 15, fontWeight: '600' },
  ackCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#d8e8df', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 16, padding: 18 },
  indicator: { backgroundColor: '#20845a', borderRadius: 8, height: 14, marginRight: 14, width: 14 },
  cardText: { flex: 1 },
  cardTitle: { color: '#14283f', fontSize: 17, fontWeight: '600', marginBottom: 5 },
  body: { color: '#52677c', fontSize: 14, lineHeight: 21 },
  primaryButton: { alignItems: 'center', backgroundColor: '#176c9c', borderRadius: 12, marginTop: 14, paddingHorizontal: 18, paddingVertical: 16 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#e4eef5', borderRadius: 12, marginTop: 10, paddingHorizontal: 18, paddingVertical: 16 },
  secondaryButtonText: { color: '#176083', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  footerNote: { color: '#687c90', fontSize: 13, lineHeight: 20, marginTop: 18 },
  input: { backgroundColor: '#ffffff', borderColor: '#d7e0e9', borderRadius: 10, borderWidth: 1, color: '#14283f', fontSize: 15, padding: 12 },
  protocolCard: { backgroundColor: '#ffffff', borderColor: '#e1e8ef', borderRadius: 16, borderWidth: 1, marginBottom: 16, padding: 18 },
  sectionLabel: { color: '#58708b', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  protocolTitle: { color: '#14283f', fontSize: 17, fontWeight: '600', marginBottom: 8 },
  locationCard: { backgroundColor: '#ffffff', borderColor: '#e1e8ef', borderRadius: 16, borderWidth: 1, marginBottom: 20, padding: 18 },
  locationTitle: { color: '#14283f', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  coordinate: { color: '#14283f', fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600', marginBottom: 6 },
  error: { color: '#a63333', fontSize: 14, lineHeight: 21, marginTop: 6 },
  privacyNote: { color: '#687c90', fontSize: 12, lineHeight: 18, marginTop: 12 },
});
