import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

export default function RoomsScreen({ route }: any) {
    const { user } = useAuth();
    const { rooms, getUserDevices, toggleDevice, addDevice, deleteDevice, turnAllOn, turnAllOffRoom, applyScene, isServerControlled } = useData();
    const [selectedRoom, setSelectedRoom] = useState<string | null>(route?.params?.roomId || null);
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [newDeviceName, setNewDeviceName] = useState('');
    const [newDeviceType, setNewDeviceType] = useState<'light' | 'fan' | 'ac' | 'outlet'>('light');
    const [newDevicePower, setNewDevicePower] = useState('');

    useEffect(() => {
        if (route?.params?.roomId) {
            setSelectedRoom(route.params.roomId);
        }
    }, [route?.params?.roomId, route?.params?.timestamp]);

    if (selectedRoom) {
        const room = rooms.find(item => item.id === selectedRoom);
        if (!room) return null;

        const roomDevices = getUserDevices(selectedRoom);
        const activeDevices = roomDevices.filter(device => device.isOn).length;
        const totalPower = roomDevices.filter(device => device.isOn).reduce((sum, device) => sum + device.power, 0);

        return (
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.roomHeader}>
                    <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.backBtn}>
                        <Text style={{ fontSize: 22 }}>←</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.roomTitle}>{room.name}</Text>
                        <Text style={styles.roomSubtitle}>{activeDevices}/{roomDevices.length} thiết bị hoạt động</Text>
                    </View>
                </View>

                <View style={styles.roomStats}>
                    <View style={styles.roomStatCard}>
                        <Text style={{ fontSize: 14 }}>⚡</Text>
                        <Text style={styles.roomStatLabel}>Công suất</Text>
                        <Text style={styles.roomStatValue}>{totalPower}W</Text>
                    </View>
                    <View style={styles.roomStatCard}>
                        <Text style={{ fontSize: 14 }}>📱</Text>
                        <Text style={styles.roomStatLabel}>Thiết bị</Text>
                        <Text style={styles.roomStatValue}>{roomDevices.length}</Text>
                    </View>
                    <View style={styles.roomStatCard}>
                        <Text style={{ fontSize: 14 }}>✅</Text>
                        <Text style={styles.roomStatLabel}>Đang bật</Text>
                        <Text style={styles.roomStatValue}>{activeDevices}</Text>
                    </View>
                </View>

                <View style={styles.allBtnRow}>
                    <TouchableOpacity style={[styles.allBtn, { backgroundColor: Colors.green[500] }]} onPress={() => { void turnAllOn(selectedRoom); }}>
                        <Text style={styles.allBtnText}>⚡ Bật tất cả</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.allBtn, { backgroundColor: Colors.slate[200] }]} onPress={() => { void turnAllOffRoom(selectedRoom); }}>
                        <Text style={[styles.allBtnText, { color: Colors.slate[700] }]}>🔌 Tắt tất cả</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Thiết bị</Text>
                {roomDevices.length === 0 ? (
                    <View style={styles.emptyDevicesCard}>
                        <Text style={styles.emptyDevicesIcon}>📦</Text>
                        <Text style={styles.emptyDevicesTitle}>Phòng này chưa có thiết bị</Text>
                        <Text style={styles.emptyDevicesText}>Hãy thêm các thiết bị thực tế đang có trong nhà của bạn.</Text>
                    </View>
                ) : (
                    roomDevices.map(device => (
                        <View key={device.id} style={[styles.deviceCard, device.isOn && styles.deviceCardActive]}>
                            <View style={styles.deviceLeft}>
                                <View style={[styles.deviceIcon, { backgroundColor: device.isOn ? Colors.green[100] : Colors.slate[100] }]}>
                                    <Text style={{ fontSize: 20 }}>
                                        {device.type === 'light' ? '💡' : device.type === 'fan' ? '🌀' : device.type === 'ac' ? '❄️' : '🔌'}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.deviceName}>{device.name}</Text>
                                    <Text style={styles.deviceStatus}>{device.isOn ? `${device.power}W - Đang bật` : 'Đã tắt'}</Text>
                                </View>
                            </View>
                            <View style={styles.deviceActions}>
                                <TouchableOpacity
                                    style={[styles.toggle, device.isOn && styles.toggleActive]}
                                    onPress={() => { void toggleDevice(selectedRoom, device.id); }}
                                >
                                    <View style={[styles.toggleCircle, device.isOn && styles.toggleCircleActive]} />
                                </TouchableOpacity>
                                {!isServerControlled && (
                                    <TouchableOpacity
                                        style={styles.deleteDeviceBtn}
                                        onPress={() => {
                                            Alert.alert('Xóa thiết bị', `Xóa "${device.name}" khỏi ${room.name}?`, [
                                                { text: 'Hủy', style: 'cancel' },
                                                { text: 'Xóa', style: 'destructive', onPress: () => { void deleteDevice(selectedRoom, device.id); } },
                                            ]);
                                        }}
                                    >
                                        <Text style={styles.deleteDeviceText}>Xóa</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))
                )}

                {!isServerControlled && (
                    <TouchableOpacity style={styles.addDeviceBtn} onPress={() => setShowAddDevice(true)}>
                        <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.addDeviceBtnGradient}>
                            <Text style={styles.addDeviceBtnText}>+ Thêm thiết bị mới</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {isServerControlled && (
                    <View style={styles.haHintCard}>
                        <Text style={styles.haHintTitle}>Thiet bi dang dong bo tu server rieng</Text>
                        <Text style={styles.haHintText}>Muon them hoac xoa thiet bi, hay cap nhat tren server/PLC roi de app dong bo lai.</Text>
                    </View>
                )}

                <Modal visible={showAddDevice} transparent animationType="slide">
                    <KeyboardAvoidingView
                        style={styles.modalOverlay}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
                    >
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Thêm thiết bị mới</Text>
                            <TextInput style={styles.modalInput} placeholder="Tên thiết bị" value={newDeviceName} onChangeText={setNewDeviceName} placeholderTextColor={Colors.slate[400]} />

                            <Text style={styles.modalLabel}>Loại thiết bị</Text>
                            <View style={styles.typeRow}>
                                {[
                                    { type: 'light' as const, label: '💡 Đèn' },
                                    { type: 'fan' as const, label: '🌀 Quạt' },
                                    { type: 'ac' as const, label: '❄️ Máy lạnh' },
                                    { type: 'outlet' as const, label: '🔌 Ổ cắm' },
                                ].map(item => (
                                    <TouchableOpacity key={item.type} style={[styles.typeBtn, newDeviceType === item.type && styles.typeBtnActive]} onPress={() => setNewDeviceType(item.type)}>
                                        <Text style={[styles.typeBtnText, newDeviceType === item.type && styles.typeBtnTextActive]}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput style={styles.modalInput} placeholder="Công suất (W)" value={newDevicePower} onChangeText={setNewDevicePower} keyboardType="numeric" placeholderTextColor={Colors.slate[400]} />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddDevice(false)}>
                                    <Text style={styles.modalCancelText}>Hủy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSaveBtn}
                                    onPress={() => {
                                        if (!newDeviceName.trim() || !newDevicePower.trim()) {
                                            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
                                            return;
                                        }
                                        void addDevice(selectedRoom, {
                                            name: newDeviceName.trim(),
                                            type: newDeviceType,
                                            isOn: false,
                                            power: parseInt(newDevicePower, 10) || 0,
                                        });
                                        setNewDeviceName('');
                                        setNewDevicePower('');
                                        setShowAddDevice(false);
                                        Alert.alert('Thành công', 'Đã thêm thiết bị mới');
                                    }}
                                >
                                    <Text style={styles.modalSaveText}>Thêm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <View style={{ height: 30 }} />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Quản lý phòng</Text>

            {user?.role === 'admin' && (
                <View style={styles.adminHintCard}>
                    <Text style={styles.adminHintTitle}>Quản trị viên</Text>
                    <Text style={styles.adminHintText}>He thong dang dung server rieng lam trung tam. Quan ly user van nam o tab Quan ly.</Text>
                </View>
            )}

            <View style={styles.roomGrid}>
                {rooms.map(room => {
                    const isActive = room.active > 0;
                    return (
                        <TouchableOpacity key={room.id} style={[styles.roomCard, isActive && styles.roomCardActive]} onPress={() => setSelectedRoom(room.id)}>
                            {isActive && <View style={styles.roomActiveDot} />}
                            <View style={[styles.roomCardIcon, { backgroundColor: isActive ? Colors.green[100] : Colors.slate[100] }]}>
                                <Text style={{ fontSize: 22 }}>🏠</Text>
                            </View>
                            <Text style={styles.roomCardName}>{room.name}</Text>
                            <Text style={styles.roomCardSub}>{room.active}/{room.devices} thiết bị</Text>
                            <View style={styles.roomCardStats}>
                                <Text style={styles.roomCardStat}>⚡ {room.power}W</Text>
                                <Text style={styles.roomCardStat}>📱 {room.devices} thiết bị</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Cảnh nhanh</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                    { label: '☀️ Buổi sáng', colors: [Colors.orange[400], Colors.amber[400]], scene: 'morning' as const },
                    { label: '⚡ Đi làm', colors: [Colors.blue[400], Colors.indigo[400]], scene: 'work' as const },
                    { label: '🎉 Cuối tuần', colors: [Colors.purple[400], Colors.pink[400]], scene: 'weekend' as const },
                    { label: '😴 Ngủ', colors: [Colors.slate[600], Colors.slate[700]], scene: 'sleep' as const },
                ].map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => {
                            Alert.alert('Kích hoạt cảnh', `Bật chế độ ${item.label}?`, [
                                { text: 'Hủy', style: 'cancel' },
                                {
                                    text: 'Bật',
                                    onPress: () => {
                                        void applyScene(item.scene);
                                        Alert.alert('Thành công', `Đã kích hoạt cảnh ${item.label}`);
                                    },
                                },
                            ]);
                        }}
                    >
                        <LinearGradient colors={item.colors as [string, string]} style={styles.sceneBtn}>
                            <Text style={styles.sceneBtnText}>{item.label}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.energyCard}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Tiêu thụ theo phòng</Text>
                {rooms.map(room => {
                    const maxPower = Math.max(...rooms.map(item => item.power), 1);
                    const pct = Math.round((room.power / maxPower) * 100);
                    return (
                        <View key={room.id} style={{ marginBottom: 12 }}>
                            <View style={styles.energyRow}>
                                <Text style={styles.energyLabel}>{room.name}</Text>
                                <Text style={styles.energyValue}>{room.power}W</Text>
                            </View>
                            <View style={styles.energyBarBg}>
                                {room.power > 0 && (
                                    <LinearGradient colors={[Colors.primary[400], Colors.primary[600]]} style={[styles.energyBarFill, { width: `${Math.max(pct, 3)}%` }]} />
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={{ height: 20 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
    pageTitle: { fontSize: 22, fontWeight: '600', color: Colors.slate[800], marginBottom: 16, marginTop: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.slate[800], marginBottom: 10 },
    roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    roomCard: { width: '48%' as any, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, position: 'relative' },
    roomCardActive: { borderWidth: 2, borderColor: Colors.green[400] },
    roomActiveDot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.green[500] },
    roomCardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    roomCardName: { fontSize: 15, fontWeight: '600', color: Colors.slate[800] },
    roomCardSub: { fontSize: 12, color: Colors.slate[500], marginTop: 2, marginBottom: 6 },
    roomCardStats: { flexDirection: 'row', gap: 10 },
    roomCardStat: { fontSize: 11, color: Colors.slate[400] },
    sceneBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, marginRight: 10 },
    sceneBtnText: { color: '#fff', fontWeight: '500', fontSize: 13 },
    energyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    energyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    energyLabel: { fontSize: 13, color: Colors.slate[700] },
    energyValue: { fontSize: 13, fontWeight: '500', color: Colors.slate[800] },
    energyBarBg: { height: 8, backgroundColor: Colors.slate[100], borderRadius: 4, overflow: 'hidden' },
    energyBarFill: { height: '100%', borderRadius: 4 },
    roomHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.slate[200], marginBottom: 14, backgroundColor: '#fff', marginHorizontal: -16, paddingHorizontal: 16 },
    backBtn: { padding: 6 },
    roomTitle: { fontSize: 18, fontWeight: '600', color: Colors.slate[800] },
    roomSubtitle: { fontSize: 13, color: Colors.slate[500] },
    roomStats: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    roomStatCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    roomStatLabel: { fontSize: 11, color: Colors.slate[500], marginTop: 4 },
    roomStatValue: { fontSize: 18, fontWeight: '700', color: Colors.slate[800], marginTop: 2 },
    allBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    allBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    allBtnText: { color: '#fff', fontWeight: '500', fontSize: 14 },
    deviceCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    deviceCardActive: { borderWidth: 2, borderColor: Colors.green[400] },
    deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    deviceActions: { alignItems: 'flex-end', gap: 8, marginLeft: 12 },
    deviceIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    deviceName: { fontSize: 15, fontWeight: '500', color: Colors.slate[800] },
    deviceStatus: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: Colors.slate[300], justifyContent: 'center', paddingHorizontal: 2 },
    toggleActive: { backgroundColor: Colors.green[500] },
    toggleCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
    toggleCircleActive: { alignSelf: 'flex-end' },
    deleteDeviceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.red[50], borderWidth: 1, borderColor: Colors.red[200] },
    deleteDeviceText: { fontSize: 12, fontWeight: '600', color: Colors.red[600] },
    emptyDevicesCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    emptyDevicesIcon: { fontSize: 28, marginBottom: 10 },
    emptyDevicesTitle: { fontSize: 16, fontWeight: '600', color: Colors.slate[800], marginBottom: 4 },
    emptyDevicesText: { fontSize: 13, color: Colors.slate[500], textAlign: 'center', lineHeight: 18 },
    addDeviceBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 10 },
    addDeviceBtnGradient: { padding: 14, alignItems: 'center' },
    addDeviceBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    haHintCard: { backgroundColor: Colors.blue[50], borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.blue[200], marginTop: 10 },
    haHintTitle: { fontSize: 14, fontWeight: '700', color: Colors.blue[700], marginBottom: 4 },
    haHintText: { fontSize: 13, color: Colors.blue[700], lineHeight: 18 },
    adminHintCard: { backgroundColor: Colors.amber[50], borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.amber[200], marginBottom: 14 },
    adminHintTitle: { fontSize: 14, fontWeight: '700', color: Colors.amber[700], marginBottom: 4 },
    adminHintText: { fontSize: 13, color: Colors.amber[700], lineHeight: 18 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: '600', color: Colors.slate[800], marginBottom: 16 },
    modalLabel: { fontSize: 14, fontWeight: '500', color: Colors.slate[600], marginBottom: 8, marginTop: 8 },
    modalInput: { backgroundColor: Colors.slate[50], borderRadius: 12, padding: 14, fontSize: 16, color: Colors.slate[800], borderWidth: 1, borderColor: Colors.slate[200], marginBottom: 8 },
    typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    typeBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.slate[200], alignItems: 'center' },
    typeBtnActive: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
    typeBtnText: { fontSize: 12, color: Colors.slate[600] },
    typeBtnTextActive: { color: Colors.primary[600], fontWeight: '600' },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.slate[100], alignItems: 'center' },
    modalCancelText: { color: Colors.slate[600], fontWeight: '500' },
    modalSaveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.primary[600], alignItems: 'center' },
    modalSaveText: { color: '#fff', fontWeight: '600' },
});
