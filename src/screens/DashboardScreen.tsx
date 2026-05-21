import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useSmartHomeServer } from '../contexts/SmartHomeServerContext';
import { PowerCurrentResponse } from '../types/smartHomeServer';
import { Colors } from '../constants/colors';
const POWER_REFRESH_MS = 30000;

const DAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export default function DashboardScreen({ navigation }: any) {
    const { user } = useAuth();
    const { rooms, getTotalPower, getActiveDeviceCount, turnAllOff, applyScene } = useData();
    const { client, isConfigured } = useSmartHomeServer();
    const [now, setNow] = useState(new Date());
    const [powerCurrent, setPowerCurrent] = useState<PowerCurrentResponse | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isConfigured) return;

        const loadPower = async () => {
            try {
                setPowerCurrent(await client.getPowerCurrent());
            } catch (error) {
                console.error('Error loading server power:', error);
            }
        };

        loadPower();
        const timer = setInterval(loadPower, POWER_REFRESH_MS);
        return () => clearInterval(timer);
    }, [client, isConfigured]);

    const totalPower = getTotalPower();
    const measuredPowerKw = typeof powerCurrent?.power_kw === 'number' ? powerCurrent.power_kw : null;
    const totalPowerKW = (measuredPowerKw ?? (totalPower / 1000)).toFixed(2);
    const activeCount = getActiveDeviceCount();
    const elapsedHours = Math.max(1, now.getHours() + (now.getMinutes() / 60));
    const todayKwhEstimate = typeof powerCurrent?.energy_kwh === 'number'
        ? powerCurrent.energy_kwh.toFixed(1)
        : ((totalPower / 1000) * elapsedHours * 0.22).toFixed(1);

    const dayName = DAY_NAMES[now.getDay()];
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Chào buổi sáng!';
        if (h < 18) return 'Chào buổi chiều!';
        return 'Chào buổi tối!';
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Welcome */}
            <View style={styles.welcomeRow}>
                <View>
                    <Text style={styles.welcomeLabel}>Xin chào, {user?.name}</Text>
                    <Text style={styles.welcomeTitle}>{getGreeting()}</Text>
                </View>
                <TouchableOpacity style={styles.notifBadge} onPress={() => navigation.navigate('Analysis')}>
                    <Text style={styles.notifIcon}>🔔</Text>
                    <View style={styles.notifDot}><Text style={styles.notifDotText}>2</Text></View>
                </TouchableOpacity>
            </View>

            {/* Power Card */}
            <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.powerCard}>
                <View style={styles.powerCardCircle1} />
                <View style={styles.powerCardCircle2} />
                <View style={{ zIndex: 1 }}>
                    <View style={styles.powerHeader}>
                        <View style={styles.powerLabelRow}>
                            <Text style={{ fontSize: 16 }}>⚡</Text>
                            <Text style={styles.powerLabel}>Công suất hiện tại</Text>
                        </View>
                        <View style={styles.realtimeBadge}><Text style={styles.realtimeText}>Real-time</Text></View>
                    </View>
                    <View style={styles.powerValueRow}>
                        <Text style={styles.powerValue}>{totalPowerKW}</Text>
                        <Text style={styles.powerUnit}>kW</Text>
                    </View>
                    <Text style={styles.powerSubtext}>📈 {activeCount} thiết bị đang hoạt động</Text>
                </View>
            </LinearGradient>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: Colors.blue[100] }]}>
                        <Text>⚡</Text>
                    </View>
                    <Text style={styles.statValue}>{todayKwhEstimate}</Text>
                    <Text style={styles.statLabel}>kWh ước tính hôm nay</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: Colors.primary[100] }]}>
                        <Text>📅</Text>
                    </View>
                    <Text style={styles.statValueSmall}>{dayName}</Text>
                    <Text style={styles.statLabel}>{dateStr}</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: Colors.orange[100] }]}>
                        <Text>🕐</Text>
                    </View>
                    <Text style={styles.statValue}>{timeStr}</Text>
                    <Text style={styles.statLabel}>Giờ hiện tại</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Thao tác nhanh</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: Colors.red[200], backgroundColor: Colors.red[50] }]} onPress={() => { void turnAllOff(); }}>
                    <Text style={{ color: Colors.red[600], fontWeight: '500', fontSize: 13 }}>🔌 Tắt tất cả</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: Colors.blue[200], backgroundColor: Colors.blue[50] }]} onPress={() => {
                    Alert.alert('Chế độ đêm', 'Tắt đèn và quạt, giữ nguyên máy lạnh?', [
                        { text: 'Hủy', style: 'cancel' },
                        { text: 'Bật', onPress: () => { void applyScene('sleep'); Alert.alert('Thành công', 'Đã bật chế độ đêm - đèn và quạt đã tắt'); } },
                    ]);
                }}>
                    <Text style={{ color: Colors.blue[600], fontWeight: '500', fontSize: 13 }}>🕐 Chế độ đêm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: Colors.amber[200], backgroundColor: Colors.amber[50] }]} onPress={() => {
                    Alert.alert('Chế độ vắng nhà', 'Tắt tất cả thiết bị trong nhà?', [
                        { text: 'Hủy', style: 'cancel' },
                        { text: 'Tắt tất cả', style: 'destructive', onPress: () => { void turnAllOff(); Alert.alert('Thành công', 'Đã tắt tất cả thiết bị'); } },
                    ]);
                }}>
                    <Text style={{ color: Colors.amber[600], fontWeight: '500', fontSize: 13 }}>🏠 Vắng nhà</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Rooms */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Các phòng</Text>
                <TouchableOpacity onPress={() => navigation.navigate('RoomList')}>
                    <Text style={styles.seeAll}>Xem tất cả →</Text>
                </TouchableOpacity>
            </View>

            {rooms.slice(0, 3).map(room => (
                <TouchableOpacity key={room.id} style={styles.roomCard} onPress={() => navigation.navigate('RoomList', { roomId: room.id, timestamp: Date.now() })}>
                    <View style={styles.roomCardLeft}>
                        <View style={[styles.roomIcon, { backgroundColor: room.active > 0 ? Colors.green[100] : Colors.slate[100] }]}>
                            <Text style={{ fontSize: 20 }}>🏠</Text>
                        </View>
                        <View>
                            <Text style={styles.roomName}>{room.name}</Text>
                            <Text style={styles.roomSub}>{room.active}/{room.devices} thiết bị đang bật</Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.roomPower}>{room.power}W</Text>
                    </View>
                </TouchableOpacity>
            ))}

            {/* Energy Tip */}
            <LinearGradient colors={[Colors.amber[50], Colors.orange[50]]} style={styles.tipCard}>
                <Text style={{ fontSize: 20 }}>💡</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle}>Mẹo tiết kiệm điện</Text>
                    <Text style={styles.tipText}>Tắt các thiết bị không cần thiết khi ra khỏi phòng để tiết kiệm điện năng.</Text>
                </View>
            </LinearGradient>

            <View style={{ height: 20 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
    welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
    welcomeLabel: { fontSize: 14, color: Colors.slate[500] },
    welcomeTitle: { fontSize: 20, fontWeight: '600', color: Colors.slate[800] },
    notifBadge: { padding: 8, backgroundColor: '#fff', borderRadius: 12, position: 'relative' },
    notifIcon: { fontSize: 18 },
    notifDot: { position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red[500], alignItems: 'center', justifyContent: 'center' },
    notifDotText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    powerCard: { borderRadius: 20, padding: 20, marginBottom: 16, overflow: 'hidden' },
    powerCardCircle1: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
    powerCardCircle2: { position: 'absolute', bottom: -30, left: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
    powerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    powerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    powerLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    realtimeBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    realtimeText: { fontSize: 11, color: '#fff' },
    powerValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 },
    powerValue: { fontSize: 44, fontWeight: '700', color: '#fff' },
    powerUnit: { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
    powerSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 22, fontWeight: '700', color: Colors.slate[800] },
    statValueSmall: { fontSize: 16, fontWeight: '700', color: Colors.slate[800] },
    statLabel: { fontSize: 11, color: Colors.slate[500], marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.slate[800], marginBottom: 10 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    seeAll: { fontSize: 13, fontWeight: '500', color: Colors.primary[600] },
    quickActions: { marginBottom: 20 },
    actionBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginRight: 10 },
    roomCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    roomCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    roomIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    roomName: { fontSize: 15, fontWeight: '500', color: Colors.slate[800] },
    roomSub: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    roomPower: { fontSize: 15, fontWeight: '600', color: Colors.slate[800] },
    roomTemp: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.amber[200], marginTop: 6 },
    tipTitle: { fontSize: 14, fontWeight: '500', color: Colors.amber[800], marginBottom: 4 },
    tipText: { fontSize: 13, color: Colors.amber[700], lineHeight: 18 },
});
