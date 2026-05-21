import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Colors } from '../constants/colors';

export default function AdminScreen() {
    const { users, approveUser, rejectUser, deleteUser } = useAuth();
    const { activityLogs, getRoomsForUser, getUserDevices, getTotalPower, getActiveDeviceCount, getHouseDeviceCount, deleteDevice, isServerControlled } = useData();
    const [managedUserId, setManagedUserId] = useState<string | null>(null);

    const pendingUsers = users.filter(user => user.status === 'pending');
    const approvedUsers = users.filter(user => user.status === 'approved' && user.role !== 'admin');
    const rejectedUsers = users.filter(user => user.status === 'rejected');
    const managedUser = approvedUsers.find(user => user.id === managedUserId) || null;
    const managedRooms = useMemo(() => managedUserId ? getRoomsForUser(managedUserId) : [], [getRoomsForUser, managedUserId]);

    const handleApprove = (userId: string, name: string) => {
        Alert.alert('Duyệt tài khoản', `Duyệt tài khoản "${name}"?`, [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Duyệt', onPress: () => { approveUser(userId); Alert.alert('Thành công', `Đã duyệt tài khoản "${name}"`); } },
        ]);
    };

    const handleReject = (userId: string, name: string) => {
        Alert.alert('Từ chối tài khoản', `Từ chối tài khoản "${name}"?`, [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Từ chối', style: 'destructive', onPress: () => { rejectUser(userId); Alert.alert('Đã từ chối', `Tài khoản "${name}" đã bị từ chối`); } },
        ]);
    };

    const handleDeleteUser = (userId: string, name: string) => {
        Alert.alert('Xóa người dùng', `Xóa vĩnh viễn tài khoản "${name}"?`, [
            { text: 'Hủy', style: 'cancel' },
            {
                text: 'Xóa',
                style: 'destructive',
                onPress: async () => {
                    const result = await deleteUser(userId);
                    Alert.alert(result.success ? 'Thành công' : 'Lỗi', result.message);
                    if (managedUserId === userId) setManagedUserId(null);
                },
            },
        ]);
    };

    const formatTime = (iso: string) => {
        const date = new Date(iso);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate()}/${date.getMonth() + 1}`;
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Quản lý hệ thống</Text>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: Colors.amber[50] }]}>
                    <Text style={styles.statValue}>{pendingUsers.length}</Text>
                    <Text style={styles.statLabel}>Chờ duyệt</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.green[50] }]}>
                    <Text style={styles.statValue}>{approvedUsers.length}</Text>
                    <Text style={styles.statLabel}>Đã duyệt</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.red[50] }]}>
                    <Text style={styles.statValue}>{rejectedUsers.length}</Text>
                    <Text style={styles.statLabel}>Từ chối</Text>
                </View>
            </View>

            {pendingUsers.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>⏳ Chờ duyệt ({pendingUsers.length})</Text>
                    {pendingUsers.map(currentUser => (
                        <View key={currentUser.id} style={[styles.userCard, { borderLeftColor: Colors.amber[400], borderLeftWidth: 4 }]}>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{currentUser.name}</Text>
                                <Text style={styles.userPhone}>📱 {currentUser.phone}</Text>
                                <Text style={styles.userDate}>Đăng ký: {formatTime(currentUser.createdAt)}</Text>
                            </View>
                            <View style={styles.actionBtns}>
                                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(currentUser.id, currentUser.name)}>
                                    <Text style={styles.approveBtnText}>✓ Duyệt</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(currentUser.id, currentUser.name)}>
                                    <Text style={styles.rejectBtnText}>✕ Từ chối</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteUserBtn} onPress={() => handleDeleteUser(currentUser.id, currentUser.name)}>
                                    <Text style={styles.deleteUserText}>🗑 Xóa</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </>
            )}

            {pendingUsers.length === 0 && (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyIcon}>✅</Text>
                    <Text style={styles.emptyText}>Không có tài khoản nào chờ duyệt</Text>
                </View>
            )}

            <Text style={styles.sectionTitle}>👥 Người dùng đã duyệt ({approvedUsers.length})</Text>
            {approvedUsers.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Chưa có người dùng nào</Text>
                </View>
            ) : approvedUsers.map(currentUser => {
                const deviceCount = getHouseDeviceCount(currentUser.id);
                const activeCount = getActiveDeviceCount(currentUser.id);
                const totalPower = getTotalPower(currentUser.id);

                return (
                    <View key={currentUser.id} style={[styles.userCard, { borderLeftColor: Colors.green[400], borderLeftWidth: 4 }]}>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{currentUser.name}</Text>
                            <Text style={styles.userPhone}>📱 {currentUser.phone}</Text>
                            <Text style={styles.userDate}>
                                {currentUser.lastActive ? `Online: ${formatTime(currentUser.lastActive)}` : 'Chưa đăng nhập'}
                            </Text>
                            <Text style={styles.houseSummary}>{deviceCount} thiết bị, {activeCount} đang bật, {totalPower}W</Text>
                        </View>
                        <View style={styles.approvedActions}>
                            <View style={[styles.statusBadge, { backgroundColor: Colors.green[100] }]}>
                                <Text style={[styles.statusText, { color: Colors.green[700] }]}>Active</Text>
                            </View>
                            <View style={styles.approvedBtnRow}>
                                <TouchableOpacity style={styles.manageBtn} onPress={() => setManagedUserId(currentUser.id)}>
                                    <Text style={styles.manageBtnText}>Xem nhà</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.deleteUserBtn} onPress={() => handleDeleteUser(currentUser.id, currentUser.name)}>
                                    <Text style={styles.deleteUserText}>Xóa</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );
            })}

            <Text style={styles.sectionTitle}>📋 Hoạt động gần đây</Text>
            {activityLogs.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Chưa có hoạt động nào</Text>
                </View>
            ) : activityLogs.slice(0, 12).map(log => (
                <View key={log.id} style={styles.logItem}>
                    <View style={styles.logDot} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.logText}>
                            <Text style={{ fontWeight: '600' }}>{log.userName}</Text> {log.action}
                            {log.device ? ` "${log.device}"` : ''}
                            {log.room ? ` tại ${log.room}` : ''}
                            {log.houseOwnerName ? ` trong nhà ${log.houseOwnerName}` : ''}
                        </Text>
                        <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                    </View>
                </View>
            ))}

            <View style={{ height: 30 }} />

            <Modal visible={!!managedUser} transparent animationType="slide" onRequestClose={() => setManagedUserId(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {managedUser && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>{isServerControlled ? 'Nha dung chung tren server' : `Nhà của ${managedUser.name}`}</Text>
                                        <Text style={styles.modalSubtitle}>{managedUser.phone}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setManagedUserId(null)}>
                                        <Text style={styles.closeText}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.houseStatsRow}>
                                    <View style={styles.houseStatCard}>
                                        <Text style={styles.houseStatValue}>{getHouseDeviceCount(managedUser.id)}</Text>
                                        <Text style={styles.houseStatLabel}>Thiết bị</Text>
                                    </View>
                                    <View style={styles.houseStatCard}>
                                        <Text style={styles.houseStatValue}>{getActiveDeviceCount(managedUser.id)}</Text>
                                        <Text style={styles.houseStatLabel}>Đang bật</Text>
                                    </View>
                                    <View style={styles.houseStatCard}>
                                        <Text style={styles.houseStatValue}>{getTotalPower(managedUser.id)}W</Text>
                                        <Text style={styles.houseStatLabel}>Tổng tải</Text>
                                    </View>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {managedRooms.map(room => {
                                        const roomDevices = getUserDevices(room.id, managedUser.id);
                                        return (
                                            <View key={room.id} style={styles.roomSection}>
                                                <View style={styles.roomSectionHeader}>
                                                    <Text style={styles.roomSectionTitle}>{room.name}</Text>
                                                    <Text style={styles.roomSectionMeta}>{room.active}/{room.devices} thiết bị, {room.power}W</Text>
                                                </View>
                                                {roomDevices.length === 0 ? (
                                                    <View style={styles.roomEmptyBox}>
                                                        <Text style={styles.roomEmptyText}>Phòng này chưa có thiết bị</Text>
                                                    </View>
                                                ) : roomDevices.map(device => (
                                                    <View key={device.id} style={styles.deviceRow}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.deviceRowName}>{device.name}</Text>
                                                            <Text style={styles.deviceRowMeta}>{device.power}W • {device.isOn ? 'Đang bật' : 'Đã tắt'}</Text>
                                                        </View>
                                                        {!isServerControlled && (
                                                            <TouchableOpacity
                                                                style={styles.deleteDeviceBtn}
                                                                onPress={() => {
                                                                    Alert.alert('Xóa thiết bị', `Admin xóa "${device.name}" khỏi ${room.name}?`, [
                                                                        { text: 'Hủy', style: 'cancel' },
                                                                        {
                                                                            text: 'Xóa',
                                                                            style: 'destructive',
                                                                            onPress: () => { void deleteDevice(room.id, device.id, managedUser.id); },
                                                                        },
                                                                    ]);
                                                                }}
                                                            >
                                                                <Text style={styles.deleteDeviceText}>Xóa</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ))}
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
    pageTitle: { fontSize: 22, fontWeight: '600', color: Colors.slate[800], marginTop: 8, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.slate[800], marginBottom: 10, marginTop: 16 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
    statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
    statValue: { fontSize: 26, fontWeight: '700', color: Colors.slate[800] },
    statLabel: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    userCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '600', color: Colors.slate[800] },
    userPhone: { fontSize: 13, color: Colors.slate[500], marginTop: 2 },
    userDate: { fontSize: 11, color: Colors.slate[400], marginTop: 4 },
    houseSummary: { fontSize: 12, color: Colors.primary[600], marginTop: 4, fontWeight: '500' },
    actionBtns: { gap: 6 },
    approvedActions: { alignItems: 'flex-end', gap: 8 },
    approvedBtnRow: { flexDirection: 'row', gap: 6 },
    approveBtn: { backgroundColor: Colors.green[500], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    rejectBtn: { backgroundColor: Colors.red[50], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.red[200] },
    rejectBtnText: { color: Colors.red[600], fontSize: 13, fontWeight: '500' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { fontSize: 12, fontWeight: '600' },
    manageBtn: { backgroundColor: Colors.primary[600], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    manageBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    deleteUserBtn: { backgroundColor: Colors.red[50], borderColor: Colors.red[200], borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    deleteUserText: { color: Colors.red[600], fontSize: 12, fontWeight: '600' },
    emptyBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 6 },
    emptyIcon: { fontSize: 24, marginBottom: 6 },
    emptyText: { fontSize: 14, color: Colors.slate[400] },
    logItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.slate[100] },
    logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary[400], marginTop: 6 },
    logText: { fontSize: 13, color: Colors.slate[700], lineHeight: 18 },
    logTime: { fontSize: 11, color: Colors.slate[400], marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '88%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.slate[800] },
    modalSubtitle: { fontSize: 13, color: Colors.slate[500], marginTop: 2 },
    closeText: { fontSize: 22, color: Colors.slate[400] },
    houseStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    houseStatCard: { flex: 1, backgroundColor: Colors.slate[50], borderRadius: 12, padding: 12, alignItems: 'center' },
    houseStatValue: { fontSize: 18, fontWeight: '700', color: Colors.slate[800] },
    houseStatLabel: { fontSize: 11, color: Colors.slate[500], marginTop: 4 },
    roomSection: { marginBottom: 14, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: Colors.slate[200], padding: 14 },
    roomSectionHeader: { marginBottom: 10 },
    roomSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.slate[800] },
    roomSectionMeta: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    roomEmptyBox: { backgroundColor: Colors.slate[50], borderRadius: 10, padding: 12 },
    roomEmptyText: { fontSize: 13, color: Colors.slate[500] },
    deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.slate[100] },
    deviceRowName: { fontSize: 14, fontWeight: '600', color: Colors.slate[800] },
    deviceRowMeta: { fontSize: 12, color: Colors.slate[500], marginTop: 2 },
    deleteDeviceBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.red[50], borderWidth: 1, borderColor: Colors.red[200] },
    deleteDeviceText: { fontSize: 12, fontWeight: '600', color: Colors.red[600] },
});
