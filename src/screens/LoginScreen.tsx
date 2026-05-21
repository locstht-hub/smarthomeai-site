import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

const APP_LOGO = require('../../assets/icon.png');

export default function LoginScreen({ navigation }: any) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!phone.trim() || !password.trim()) {
            Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại và mật khẩu');
            return;
        }
        setLoading(true);
        const result = await login(phone.trim(), password);
        setLoading(false);
        if (!result.success) {
            Alert.alert('Đăng nhập thất bại', result.message);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Image source={APP_LOGO} style={styles.logoImage} resizeMode="cover" />
                    </View>
                    <Text style={styles.appName}>Smart Home</Text>
                    <Text style={styles.subtitle}>Điều khiển ngôi nhà thông minh</Text>
                </LinearGradient>

                {/* Form */}
                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>Đăng nhập</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Số điện thoại</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập số điện thoại"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                            placeholderTextColor={Colors.slate[400]}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mật khẩu</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor={Colors.slate[400]}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        <LinearGradient colors={[Colors.primary[500], Colors.primary[700]]} style={styles.loginButtonGradient}>
                            <Text style={styles.loginButtonText}>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.registerRow}>
                        <Text style={styles.registerText}>Chưa có tài khoản? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.registerLink}>Đăng ký ngay</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Demo credentials */}
                    <View style={styles.demoBox}>
                        <Text style={styles.demoTitle}>Tài khoản Admin:</Text>
                        <Text style={styles.demoText}>SĐT: 0123456789</Text>
                        <Text style={styles.demoText}>MK: admin123</Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: { flexGrow: 1 },
    header: { paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
    logoContainer: {
        width: 70, height: 70, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        overflow: 'hidden',
    },
    logoImage: { width: 70, height: 70 },
    appName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    formContainer: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -20, padding: 24, paddingTop: 32 },
    formTitle: { fontSize: 24, fontWeight: '700', color: Colors.slate[800], marginBottom: 24 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '500', color: Colors.slate[600], marginBottom: 6 },
    input: {
        backgroundColor: Colors.slate[50], borderRadius: 12, padding: 14,
        fontSize: 16, color: Colors.slate[800], borderWidth: 1, borderColor: Colors.slate[200],
    },
    loginButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
    loginButtonDisabled: { opacity: 0.6 },
    loginButtonGradient: { padding: 16, alignItems: 'center' },
    loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    registerText: { fontSize: 14, color: Colors.slate[500] },
    registerLink: { fontSize: 14, fontWeight: '600', color: Colors.primary[600] },
    demoBox: {
        marginTop: 24, padding: 16, backgroundColor: Colors.primary[50],
        borderRadius: 12, borderWidth: 1, borderColor: Colors.primary[200],
    },
    demoTitle: { fontSize: 13, fontWeight: '600', color: Colors.primary[700], marginBottom: 4 },
    demoText: { fontSize: 13, color: Colors.primary[600] },
});
