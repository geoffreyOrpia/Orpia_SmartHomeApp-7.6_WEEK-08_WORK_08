import React from 'react';
import { Text, View } from 'react-native';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useIoT } from '../../context/IoTContext';
import { usePalette } from '../../theme/theme';
import { Button, Card, DeviceCard, Empty, Feedback, Screen, Section, SensorTiles, ui } from '../../components/UI';
import { HomeRoutes } from '../DrawerNavigator';

export default function DashboardScreen({ navigation }: DrawerScreenProps<HomeRoutes, 'Dashboard'>) {
  const h = useIoT(); const p = usePalette(); const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const active = h.devices.filter(d => d.status && d.online).length;
  return <Screen title={h.preferences.homeName} subtitle={`${greeting}. A little closer to your home.`} action={<Button label="Refresh home" secondary loading={h.isRefreshing} onPress={() => void h.refresh()} />}>
    <View style={{ backgroundColor: '#214F39', padding: 26, borderRadius: 24, marginBottom: 24, overflow: 'hidden' }}>
      <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
        <View style={{ flex: 1, minWidth: 180 }}><Text style={{ color: '#B9D8C3', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>HOME OVERVIEW</Text>
          <Text style={{ color: '#F6FFF4', fontSize: 27, fontWeight: '600', marginTop: 14, lineHeight: 34 }}>{h.isGatewayConnected ? 'Your home, at a glance.' : 'Let’s reconnect your home.'}</Text>
          <Text style={{ color: '#C6DDCC', marginTop: 10, lineHeight: 21 }}>{h.isGatewayConnected ? `${h.devices.length} devices · ${active} active · ${new Set(h.devices.map(d => d.room)).size} rooms` : 'Check your gateway and refresh to reconnect.'}</Text>
        </View><Ionicons name="home-outline" size={64} color="#9EC7A8" style={{ margin: 12 }} />
      </View>
      <View style={[ui.row, { borderTopWidth: 1, borderColor: '#416A50', paddingTop: 18, marginTop: 22 }]}><Ionicons name={h.isGatewayConnected ? 'wifi-outline' : 'cloud-offline-outline'} size={18} color="#C6DDCC" />
        <Text style={{ color: '#E6F4E9', fontSize: 12 }}>{h.isGatewayConnected ? `${h.gateway?.name} connected` : h.isRefreshing ? 'Checking connection…' : 'Gateway unavailable'}</Text></View>
    </View>
    <Section title="Your environment" action={<Button label="View sensors" secondary onPress={() => navigation.navigate('Sensors')} />} />
    {h.sensorError && <Feedback message={h.sensorError} retry={() => void h.refresh()} disabled={h.isRefreshing} />}
    <SensorTiles />
    <Section title="Device controls" action={<Button label="All devices" secondary onPress={() => navigation.navigate('Devices')} />} />
    {h.deviceError && <Feedback message={h.deviceError} retry={() => void h.refresh()} disabled={h.isRefreshing} />}
    {h.devices.length ? <View style={[ui.wrap, { marginBottom: 20 }]}>{h.devices.slice(0, 4).map(device => <DeviceCard key={device.id} device={device} />)}</View> : <Empty loading={h.isRefreshing} title={h.isRefreshing ? 'Loading your home' : 'No devices yet'} description="Add your first device from the Devices page." />}
    <Section title="Recent activity" />
    <Card>{h.activity.length ? h.activity.slice(0, 5).map((a, index) => <View key={a.id} style={[ui.row, { paddingVertical: 14, borderTopWidth: index ? 1 : 0, borderColor: p.border }]}>
      <Ionicons name="checkmark-circle-outline" size={22} color={p.accent} /><View style={{ flex: 1 }}><Text style={{ color: p.text, lineHeight: 21 }}>{a.message}</Text><Text style={{ color: p.muted, fontSize: 12, marginTop: 4 }}>{new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
    </View>) : <Text style={{ color: p.muted, lineHeight: 22 }}>Device changes made during this session will appear here.</Text>}</Card>
  </Screen>;
}
