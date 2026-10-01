import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { Device, Gateway, NewDevice, SensorData } from '../models/IoTModels';
import { iotApi } from '../services/IoTService';

type Preferences = { darkMode: boolean; autoRefresh: boolean; fahrenheit: boolean; homeName: string };
type Activity = { id: number; message: string; time: string };
const defaults: Preferences = { darkMode: false, autoRefresh: true, fahrenheit: false, homeName: 'My home' };
function useHomeState() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('orpia.preferences').then(raw => {
      if (!mounted || !raw) return;
      const p = JSON.parse(raw);
      setPreferences({ darkMode: p.darkMode === true, autoRefresh: p.autoRefresh !== false, fahrenheit: p.fahrenheit === true, homeName: typeof p.homeName === 'string' && p.homeName.trim() ? p.homeName.slice(0, 40) : defaults.homeName });
    }).catch(() => { if (mounted) setPreferenceError('Saved preferences could not be loaded.'); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  const updatePreferences = (patch: Partial<Preferences>) => setPreferences(p => ({ ...p, ...patch }));
  useEffect(() => {
    if (!ready) return;
    saveQueue.current = saveQueue.current.then(() => AsyncStorage.setItem('orpia.preferences', JSON.stringify(preferences)))
      .then(() => setPreferenceError(null)).catch(() => setPreferenceError('Preferences could not be saved on this device.'));
  }, [preferences, ready]);
  const [devices, setDevices] = useState<Device[]>([]);
  const devicesRef = useRef<Device[]>([]);
  const commitDevices = useCallback((change: (current: Device[]) => Device[]) => {
    devicesRef.current = change(devicesRef.current); setDevices(devicesRef.current);
  }, []);
  const [sensors, setSensors] = useState<SensorData | null>(null);
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const gatewayRef = useRef<Gateway | null>(null);
  const [isLoadingDevices, setLoadingDevices] = useState(false);
  const [isLoadingSensors, setLoadingSensors] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [updatingDeviceIds, setUpdatingIds] = useState<number[]>([]);
  const pending = useRef(new Set<number>());
  const addingRef = useRef(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const activityId = useRef(0);
  const record = (message: string) => setActivity(a => [{ id: ++activityId.current, message, time: new Date().toISOString() }, ...a].slice(0, 12));
  const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
  const refresh = useCallback((): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    if (pending.current.size || addingRef.current) return Promise.resolve();
    const run = async () => {
      setRefreshing(true); setGatewayError(null);
      try {
        const g = await iotApi.getGateway(); gatewayRef.current = g; setGateway(g);
        if (!g.connected) { setGatewayError('Your gateway is offline. Readings may be out of date.'); return; }
        setLoadingDevices(true); setLoadingSensors(true);
        await Promise.all([
          iotApi.getDevices().then(data => {
            // Commands are blocked during refresh; refresh is skipped while a command is pending.
            if (pending.current.size === 0) commitDevices(() => data);
            setDeviceError(null);
          }).catch(e => setDeviceError(message(e))).finally(() => setLoadingDevices(false)),
          iotApi.getSensorData().then(data => { setSensors(data); setSensorError(null); })
            .catch(e => setSensorError(message(e))).finally(() => setLoadingSensors(false)),
        ]);
      } catch (e) { gatewayRef.current = null; setGateway(null); setGatewayError(message(e)); }
      finally { setRefreshing(false); }
    };
    refreshInFlight.current = run().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }, [commitDevices]);
  const canControl = () => { if (!gatewayRef.current?.connected) throw new Error('Connect to your gateway before making changes.'); };
  const toggleDevice = async (id: number, value: boolean) => {
    if (pending.current.has(id) || refreshInFlight.current) return;
    const previous = devicesRef.current.find(d => d.id === id);
    if (!previous) return;
    try { canControl(); if (!previous.online) throw new Error('This device is offline.'); }
    catch (e) { setDeviceError(message(e)); return; }
    pending.current.add(id); setUpdatingIds([...pending.current]); setDeviceError(null);
    commitDevices(ds => ds.map(d => d.id === id ? { ...d, status: value } : d));
    try {
      const updated = await iotApi.updateDeviceStatus(id, value);
      commitDevices(ds => ds.map(d => d.id === id ? updated : d));
      record(`${updated.name} ${updated.type === 'lock' ? (updated.status ? 'locked' : 'unlocked') : (updated.status ? 'turned on' : 'turned off')}`);
    } catch (e) { commitDevices(ds => ds.map(d => d.id === id ? previous : d)); setDeviceError(message(e)); }
    finally { pending.current.delete(id); setUpdatingIds([...pending.current]); }
  };
  const addDevice = async (input: NewDevice) => {
    canControl(); if (refreshInFlight.current || addingRef.current) throw new Error('Please wait for the current update to finish.');
    addingRef.current = true;
    try {
      const result = await iotApi.addDevice(input);
      commitDevices(ds => [...ds.filter(d => d.id !== result.id), result]); record(`${result.name} added to ${result.room}`);
    } finally { addingRef.current = false; }
  };
  const removeDevice = async (id: number) => {
    canControl(); if (refreshInFlight.current || pending.current.has(id)) throw new Error('Please wait for the current update to finish.');
    const found = devicesRef.current.find(d => d.id === id);
    pending.current.add(id); setUpdatingIds([...pending.current]);
    try { await iotApi.removeDevice(id); commitDevices(ds => ds.filter(d => d.id !== id)); record(`${found?.name ?? 'Device'} removed`); }
    finally { pending.current.delete(id); setUpdatingIds([...pending.current]); }
  };
  useEffect(() => { if (ready) void refresh(); }, [ready, refresh]);
  useEffect(() => {
    if (!ready || !preferences.autoRefresh) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [ready, preferences.autoRefresh, refresh]);
  return { preferences, updatePreferences, ready, preferenceError, devices, sensors, gateway, isGatewayConnected: gateway?.connected === true,
    isLoadingDevices, isLoadingSensors, isRefreshing, deviceError, sensorError, gatewayError, updatingDeviceIds, activity,
    refresh, loadDevices: refresh, refreshSensors: refresh, toggleDevice, addDevice, removeDevice };
}
const IoTContext = createContext<ReturnType<typeof useHomeState> | null>(null);
export function IoTProvider({ children }: { children: React.ReactNode }) {
  return <IoTContext.Provider value={useHomeState()}>{children}</IoTContext.Provider>;
}
export function useIoT() {
  const context = useContext(IoTContext);
  if (!context) throw new Error('useIoT must be used inside IoTProvider');
  return context;
}
