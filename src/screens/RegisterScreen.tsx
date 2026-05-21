import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

export default function RegisterScreen({ navigation }: any) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();

    const handleRegister = async () => {
        if (!name.trim() || !phone.trim() || !password.trim()) {
            Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        setLoading(true);
        const result = await register(name.trim(), phone.trim(), password);
        setLoading(false);
        if (result.success) {
            Alert.alert('Thành công', result.message, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } else {
            Alert.alert('Lỗi', result.message);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.header}>
                    <Text style={styles.appName}>Đăng ký tài khoản</Text>
                    <Text style={styles.subtitle}>Tạo tài khoản để điều khiển nhà thông minh</Text>
                </LinearGradient>

                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Họ và tên</Text>
                        <TextInput style={styles.input} placeholder="Nhập họ và tên" value={name} onChangeText={setName} placeholderTextColor={Colors.slate[400]} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Số điện thoại</Text>
                        <TextInput style={styles.input} placeholder="Nhập số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.slate[400]} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mật khẩu</Text>
                        <TextInput style={styles.input} placeholder="Nhập mật khẩu (ít nhất 6 ký tự)" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={Colors.slate[400]} />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Xác nhận mật khẩu</Text>
                        <TextInput style={styles.input} placeholder="Nhập lại mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor={Colors.slate[400]} />
                    </View>

                    {/* Info box */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoIcon}>ℹ️</Text>
                        <Text style={styles.infoText}>Sau khi đăng ký, tài khoản sẽ cần Admin duyệt trước khi sử dụng được.</Text>
                    </View>

                    <TouchableOpacity style={[styles.registerButton, loading && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading}>
                        <LinearGradient colors={[Colors.green[500], Colors.green[700]]} style={styles.registerButtonGradient}>
                            <Text style={styles.registerButtonText}>{loading ? 'Đang xử lý...' : 'Đăng ký'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.loginRow}>
                        <Text style={styles.loginText}>Đã có tài khoản? </Text>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.loginLink}>Đăng nhập</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { flexGrow: 1 },
    header: { paddingTop: 60, paddingBottom: 30, alignItems: 'center' },
    appName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    formContainer: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -20, padding: 24, paddingTop: 28 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 14, fontWeight: '500', color: Colors.slate[600], marginBottom: 6 },
    input: { backgroundColor: Colors.slate[50], borderRadius: 12, padding: 14, fontSize: 16, color: Colors.slate[800], borderWidth: 1, borderColor: Colors.slate[200] },
    infoBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, backgroundColor: Colors.amber[50], borderRadius: 12, borderWidth: 1, borderColor: Colors.amber[200], marginBottom: 16, gap: 8 },
    infoIcon: { fontSize: 16 },
    infoText: { flex: 1, fontSize: 13, color: Colors.amber[800], lineHeight: 18 },
    registerButton: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
    registerButtonGradient: { padding: 16, alignItems: 'center' },
    registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 40 },
    loginText: { fontSize: 14, color: Colors.slate[500] },
    loginLink: { fontSize: 14, fontWeight: '600', color: Colors.primary[600] },
});
