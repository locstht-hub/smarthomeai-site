import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useSmartHomeServer } from '../contexts/SmartHomeServerContext';
import { Colors } from '../constants/colors';
import { buildPlcMappingSummary } from '../constants/plcMapping';

export default function SettingsScreen() {
    const { user, logout, changePassword } = useAuth();
    const { config, status, error, saveConfig, testConnection } = useSmartHomeServer();
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [cloudSyncEnabled, setCloudSyncEnabled] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showServerModal, setShowServerModal] = useState(false);
    const [showPlcModal, setShowPlcModal] = useState(false);
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [apiBaseUrl, setApiBaseUrl] = useState(config.apiBaseUrl);
    const [apiToken, setApiToken] = useState(config.apiToken || '');
    const [forecastApiUrl, setForecastApiUrl] = useState(config.forecastApiUrl || '');
    const [forecastModel, setForecastModel] = useState<'xgboost' | 'lstm'>(config.forecastModel || 'xgboost');
    const [plcAddress, setPlcAddress] = useState('192.168.0.1');
    const [plcPort, setPlcPort] = useState('102');
    const [plcConnected, setPlcConnected] = useState(false);

    useEffect(() => {
        setApiBaseUrl(config.apiBaseUrl);
        setApiToken(config.apiToken || '');
        setForecastApiUrl(config.forecastApiUrl || '');
        setForecastModel(config.forecastModel || 'xgboost');
    }, [config.apiBaseUrl, config.apiToken, config.forecastApiUrl, config.forecastModel]);

    const connectionLabel = status === 'connected'
        ? 'Da ket noi'
        : status === 'connecting'
            ? 'Dang kiem tra'
            : config.apiBaseUrl ? 'Chua ket noi' : 'Chua cau hinh';

    const handleChangePassword = async () => {
        if (!currentPw || !newPw || !confirmPw) {
            Alert.alert('Loi', 'Vui long nhap day du thong tin');
            return;
        }
        if (newPw !== confirmPw) {
            Alert.alert('Loi', 'Mat khau moi khong khop');
            return;
        }
        const result = await changePassword(currentPw, newPw);
        Alert.alert(result.success ? 'Thanh cong' : 'Loi', result.message);
        if (result.success) {
            setShowPasswordModal(false);
            setCurrentPw('');
            setNewPw('');
            setConfirmPw('');
        }
    };

    const handleLogout = () => {
        Alert.alert('Dang xuat', 'Ban co chac muon dang xuat?', [
            { text: 'Huy', style: 'cancel' },
            { text: 'Dang xuat', style: 'destructive', onPress: logout },
        ]);
    };

    const handleSaveServer = async () => {
        const nextConfig = {
            apiBaseUrl,
            apiToken,
            timeout: 8000,
            forecastApiUrl,
            forecastModel,
        };

        await saveConfig(nextConfig);
        const result = await testConnection(nextConfig);
        Alert.alert(
            result.success ? 'Ket noi thanh cong' : 'Khong the ket noi',
            result.success ? 'App da luu cau hinh Server API rieng.' : result.message,
        );
        if (result.success) {
            setShowServerModal(false);
        }
    };

    const handleConnectPlc = () => {
        if (!plcAddress.trim()) {
            setPlcConnected(false);
            Alert.alert('Thong bao', 'Chua nhap dia chi PLC.');
            return;
        }
        setPlcConnected(true);
        setShowPlcModal(false);
        Alert.alert('Luu cau hinh', `Da luu PLC ${plcAddress.trim()}:${plcPort || '102'}`);
    };

    const handleShowPlcMapping = () => {
        Alert.alert(
            'Mapping PLC -> Server -> App',
            `${buildPlcMappingSummary()}\n\nHuong dan nhanh:\n1) PLC luu trang thai vao tag status.\n2) Server rieng doc/ghi PLC qua Ethernet.\n3) App goi REST API cua server.\n4) Lenh dieu khien duoc server ghi vao tag command de PLC xu ly.`,
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.profileCard}>
                <View style={styles.avatar}><Text style={{ fontSize: 28, color: '#fff' }}>U</Text></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{user?.name}</Text>
                    <Text style={styles.profilePhone}>{user?.phone}</Text>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}><Text style={styles.badgeText}>{user?.role === 'admin' ? 'Admin' : 'User'}</Text></View>
                    </View>
                </View>
            </LinearGradient>

            <Text style={styles.sectionLabel}>TAI KHOAN</Text>
            <View style={styles.menuCard}>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                    Alert.alert('Thong tin ca nhan', `Ho ten: ${user?.name}\nSDT: ${user?.phone}\nVai tro: ${user?.role === 'admin' ? 'Quan tri vien' : 'Nguoi dung'}\nTrang thai: Dang hoat dong`);
                }}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>U</Text></View>
                        <Text style={styles.menuText}>Thong tin ca nhan</Text>
                    </View>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                    setNotifEnabled(!notifEnabled);
                    Alert.alert(notifEnabled ? 'Da tat thong bao' : 'Da bat thong bao');
                }}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>!</Text></View>
                        <Text style={styles.menuText}>Thong bao</Text>
                    </View>
                    <View style={[styles.toggle, notifEnabled && styles.toggleActive]}><View style={[styles.toggleCircle, notifEnabled && styles.toggleCircleActive]} /></View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setShowPasswordModal(true)}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>*</Text></View>
                        <Text style={styles.menuText}>Bao mat</Text>
                    </View>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>KET NOI</Text>
            <View style={styles.menuCard}>
                <TouchableOpacity style={styles.menuItem} onPress={() => setShowServerModal(true)}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>API</Text></View>
                        <View>
                            <Text style={styles.menuText}>Server API rieng</Text>
                            <Text style={styles.menuSubText}>{apiBaseUrl || 'Chua cau hinh API URL'}</Text>
                        </View>
                    </View>
                    <Text style={styles.menuValue}>{connectionLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setShowPlcModal(true)}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>PLC</Text></View>
                        <View>
                            <Text style={styles.menuText}>PLC S7-1200</Text>
                            <Text style={styles.menuSubText}>Laptop/server doc PLC qua Ethernet</Text>
                        </View>
                    </View>
                    <Text style={styles.menuValue}>{plcConnected ? `${plcAddress}:${plcPort}` : 'Chua ket noi'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleShowPlcMapping}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>MAP</Text></View>
                        <View>
                            <Text style={styles.menuText}>Bang mapping PLC</Text>
                            <Text style={styles.menuSubText}>PLC tag {'->'} API device {'->'} ten tren app</Text>
                        </View>
                    </View>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => {
                    setCloudSyncEnabled(!cloudSyncEnabled);
                    Alert.alert(cloudSyncEnabled ? 'Da tat dong bo Cloud' : 'Da bat dong bo Cloud');
                }}>
                    <View style={styles.menuLeft}>
                        <View style={styles.menuIcon}><Text>CL</Text></View>
                        <Text style={styles.menuText}>Dong bo Cloud</Text>
                    </View>
                    <View style={[styles.toggle, cloudSyncEnabled && styles.toggleActive]}><View style={[styles.toggleCircle, cloudSyncEnabled && styles.toggleCircleActive]} /></View>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>TRANG THAI HE THONG</Text>
            <View style={styles.statusGrid}>
                <View style={[styles.statusCard, { backgroundColor: status === 'connected' ? Colors.green[50] : Colors.amber[50] }]}>
                    <View style={[styles.statusDot, { backgroundColor: status === 'connected' ? Colors.green[500] : Colors.amber[500] }]} />
                    <Text style={[styles.statusLabel, { color: status === 'connected' ? Colors.green[700] : Colors.amber[700] }]}>Server API</Text>
                    <Text style={[styles.statusSub, { color: status === 'connected' ? Colors.green[600] : Colors.amber[600] }]}>{connectionLabel}</Text>
                </View>
                <View style={[styles.statusCard, { backgroundColor: Colors.blue[50] }]}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.blue[500] }]} />
                    <Text style={[styles.statusLabel, { color: Colors.blue[700] }]}>Cloud Sync</Text>
                    <Text style={[styles.statusSub, { color: Colors.blue[600] }]}>{cloudSyncEnabled ? 'Bat' : 'Tat'}</Text>
                </View>
                <View style={[styles.statusCard, { backgroundColor: Colors.purple[50] }]}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.purple[500] }]} />
                    <Text style={[styles.statusLabel, { color: Colors.purple[600] }]}>AI Model</Text>
                    <Text style={[styles.statusSub, { color: Colors.purple[600] }]}>{config.forecastApiUrl ? config.forecastModel?.toUpperCase() || 'XGBOOST' : 'Mo phong'}</Text>
                </View>
                <View style={[styles.statusCard, { backgroundColor: Colors.amber[50] }]}>
                    <View style={[styles.statusDot, { backgroundColor: Colors.amber[500] }]} />
                    <Text style={[styles.statusLabel, { color: Colors.amber[700] }]}>PLC</Text>
                    <Text style={[styles.statusSub, { color: Colors.amber[600] }]}>{plcConnected ? 'Da cau hinh' : 'Chua ket noi'}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Dang xuat</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Smart Home Control v3.0.0</Text>
            <Text style={styles.copyright}>Server rieng + PLC S7-1200 + MFM384</Text>
            <View style={{ height: 30 }} />

            <Modal visible={showPasswordModal} transparent animationType="slide">
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Doi mat khau</Text>
                        <TextInput style={styles.modalInput} placeholder="Mat khau hien tai" value={currentPw} onChangeText={setCurrentPw} secureTextEntry placeholderTextColor={Colors.slate[400]} />
                        <TextInput style={styles.modalInput} placeholder="Mat khau moi" value={newPw} onChangeText={setNewPw} secureTextEntry placeholderTextColor={Colors.slate[400]} />
                        <TextInput style={styles.modalInput} placeholder="Xac nhan mat khau moi" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry placeholderTextColor={Colors.slate[400]} />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPasswordModal(false)}>
                                <Text style={styles.modalCancelText}>Huy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={() => { void handleChangePassword(); }}>
                                <Text style={styles.modalSaveText}>Luu</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showPlcModal} transparent animationType="slide">
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cau hinh PLC</Text>
                        <Text style={styles.modalHint}>PLC S7-1200 CPU 1215C. Server doc tag MD qua snap7, app khong doc PLC truc tiep.</Text>
                        <TextInput style={styles.modalInput} placeholder="PLC IP" value={plcAddress} onChangeText={setPlcAddress} keyboardType="numbers-and-punctuation" autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.slate[400]} />
                        <TextInput style={styles.modalInput} placeholder="S7 port" value={plcPort} onChangeText={setPlcPort} keyboardType="number-pad" autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.slate[400]} />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPlcModal(false)}>
                                <Text style={styles.modalCancelText}>Huy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleConnectPlc}>
                                <Text style={styles.modalSaveText}>Luu</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showServerModal} transparent animationType="slide">
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cau hinh Server API</Text>
                        <Text style={styles.modalHint}>Khuyen nghi: https://api.smarthomeai.id.vn. Emulator local: http://10.0.2.2:5001. Dien thoai that local: http://IP-LAPTOP:5001.</Text>
                        <TextInput style={styles.modalInput} placeholder="Server API URL" value={apiBaseUrl} onChangeText={setApiBaseUrl} autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.slate[400]} />
                        <TextInput style={styles.modalInput} placeholder="API token (neu co)" value={apiToken} onChangeText={setApiToken} autoCorrect={false} autoCapitalize="none" secureTextEntry placeholderTextColor={Colors.slate[400]} />
                        <TextInput style={styles.modalInput} placeholder="Forecast API URL" value={forecastApiUrl} onChangeText={setForecastApiUrl} autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.slate[400]} />
                        <Text style={styles.modalLabel}>Mo hinh du bao AI</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity style={[styles.modelOption, forecastModel === 'xgboost' && styles.modelOptionActive]} onPress={() => setForecastModel('xgboost')}>
                                <Text style={[styles.modelOptionText, forecastModel === 'xgboost' && styles.modelOptionTextActive]}>XGBoost</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modelOption, forecastModel === 'lstm' && styles.modelOptionActive]} onPress={() => setForecastModel('lstm')}>
                                <Text style={[styles.modelOptionText, forecastModel === 'lstm' && styles.modelOptionTextActive]}>LSTM</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.statusHint}>Trang thai: {connectionLabel}{error ? `\n${error}` : ''}</Text>
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowServerModal(false)}>
                                <Text style={styles.modalCancelText}>Huy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={() => { void handleSaveServer(); }}>
                                <Text style={styles.modalSaveText}>Luu & kiem tra</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
    profileCard: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 20 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    profileName: { fontSize: 20, fontWeight: '600', color: '#fff' },
    profilePhone: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 11, color: '#fff' },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: Colors.slate[400], letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
    menuCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.slate[100] },
    menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.slate[100], alignItems: 'center', justifyContent: 'center' },
    menuText: { fontSize: 15, fontWeight: '500', color: Colors.slate[800] },
    menuSubText: { fontSize: 11, color: Colors.slate[500], marginTop: 2 },
    menuArrow: { fontSize: 22, color: Colors.slate[400] },
    menuValue: { fontSize: 13, color: Colors.slate[500], maxWidth: 120, textAlign: 'right' },
    toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: Colors.slate[300], justifyContent: 'center', paddingHorizontal: 2 },
    toggleActive: { backgroundColor: Colors.green[500] },
    toggleCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
    toggleCircleActive: { alignSelf: 'flex-end' },
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    statusCard: { width: '47%' as any, padding: 12, borderRadius: 14 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
    statusLabel: { fontSize: 12, fontWeight: '600' },
    statusSub: { fontSize: 11, marginTop: 2 },
    logoutBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.red[200], marginBottom: 20 },
    logoutText: { fontSize: 15, fontWeight: '600', color: Colors.red[500] },
    version: { textAlign: 'center', fontSize: 12, color: Colors.slate[400] },
    copyright: { textAlign: 'center', fontSize: 12, color: Colors.slate[400], marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: '600', color: Colors.slate[800], marginBottom: 16 },
    modalHint: { fontSize: 12, color: Colors.slate[500], marginBottom: 10, lineHeight: 18 },
    statusHint: { fontSize: 12, color: Colors.slate[500], marginBottom: 10, lineHeight: 18 },
    modalLabel: { fontSize: 13, fontWeight: '600', color: Colors.slate[700], marginBottom: 8, marginTop: 4 },
    modalInput: { backgroundColor: Colors.slate[50], borderRadius: 12, padding: 14, fontSize: 16, color: Colors.slate[800], borderWidth: 1, borderColor: Colors.slate[200], marginBottom: 10 },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.slate[100], alignItems: 'center' },
    modalCancelText: { color: Colors.slate[600], fontWeight: '500' },
    modalSaveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.primary[600], alignItems: 'center' },
    modalSaveText: { color: '#fff', fontWeight: '600' },
    modelOption: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.slate[200], backgroundColor: Colors.slate[50], alignItems: 'center' },
    modelOptionActive: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
    modelOptionText: { color: Colors.slate[600], fontWeight: '500' },
    modelOptionTextActive: { color: Colors.primary[700], fontWeight: '600' },
});
