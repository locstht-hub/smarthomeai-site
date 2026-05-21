import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, defaultAdmin, defaultApprovedUser } from '../constants/data';

interface AuthContextType {
    user: User | null;
    users: User[];
    isLoading: boolean;
    login: (phone: string, password: string) => Promise<{ success: boolean; message: string }>;
    register: (name: string, phone: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    approveUser: (userId: string) => Promise<void>;
    rejectUser: (userId: string) => Promise<void>;
    deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
    changePassword: (currentPw: string, newPw: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
const USERS_KEY = 'users';
const USERS_BACKUP_KEY = 'users_backup';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([defaultAdmin, defaultApprovedUser]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const normalizeUsers = (rawUsers: User[]): User[] => {
        const byKey = new Map<string, User>();

        // Keep all registered users, dedupe only true duplicates by id or phone.
        rawUsers.forEach((candidate) => {
            const key = candidate.id || `phone:${candidate.phone}`;
            if (!byKey.has(key)) {
                byKey.set(key, candidate);
            }
        });

        const merged = Array.from(byKey.values());
        const adminIndex = merged.findIndex((u) => u.role === 'admin');
        const withAdmin = adminIndex >= 0
            ? merged.map((u, index) => (index === adminIndex ? { ...defaultAdmin, ...u, role: 'admin' as const } : u))
            : [defaultAdmin, ...merged];

        const hasNonAdminApproved = withAdmin.some((u) => u.role !== 'admin' && u.status === 'approved');
        const hasDemoUser = withAdmin.some((u) => u.id === defaultApprovedUser.id);

        if (!hasNonAdminApproved && !hasDemoUser) {
            return [...withAdmin, defaultApprovedUser];
        }
        return withAdmin;
    };

    const readUsersFromStorage = async (): Promise<User[]> => {
        const savedUsers = await AsyncStorage.getItem(USERS_KEY);
        const savedBackup = await AsyncStorage.getItem(USERS_BACKUP_KEY);
        const source = savedUsers || savedBackup;
        const parsedUsers: User[] = source ? JSON.parse(source) : [defaultAdmin, defaultApprovedUser];

        if (!savedUsers && savedBackup) {
            await AsyncStorage.setItem(USERS_KEY, savedBackup);
        }

        return normalizeUsers(parsedUsers);
    };

    const loadData = async () => {
        try {
            const savedCurrentUser = await AsyncStorage.getItem('currentUser');

            const normalized = await readUsersFromStorage();
            setUsers(normalized);
            await AsyncStorage.setItem(USERS_KEY, JSON.stringify(normalized));

            if (savedCurrentUser) {
                const parsedCurrent = JSON.parse(savedCurrentUser) as User;
                const latestCurrent = normalized.find((item) => item.id === parsedCurrent.id) || null;
                setUser(latestCurrent);
                if (!latestCurrent) {
                    await AsyncStorage.removeItem('currentUser');
                }
            }
        } catch (e) {
            console.error('Error loading auth data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveUsers = async (newUsers: User[]) => {
        const normalized = normalizeUsers(newUsers);
        const previous = await AsyncStorage.getItem(USERS_KEY);
        if (previous) {
            await AsyncStorage.setItem(USERS_BACKUP_KEY, previous);
        }
        setUsers(normalized);
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(normalized));
    };

    const login = async (phone: string, password: string): Promise<{ success: boolean; message: string }> => {
        const allUsers = await readUsersFromStorage();

        const found = allUsers.find(u => u.phone === phone && u.password === password);
        if (!found) {
            return { success: false, message: 'Số điện thoại hoặc mật khẩu không đúng' };
        }
        if (found.status === 'pending') {
            return { success: false, message: 'Tài khoản đang chờ Admin duyệt. Vui lòng liên hệ Admin.' };
        }
        if (found.status === 'rejected') {
            return { success: false, message: 'Tài khoản đã bị từ chối. Vui lòng liên hệ Admin.' };
        }

        // Update last active
        found.lastActive = new Date().toISOString();
        const updatedUsers = allUsers.map(u => u.id === found.id ? found : u);
        await saveUsers(updatedUsers);

        setUser(found);
        await AsyncStorage.setItem('currentUser', JSON.stringify(found));
        return { success: true, message: 'Đăng nhập thành công' };
    };

    const register = async (name: string, phone: string, password: string): Promise<{ success: boolean; message: string }> => {
        const allUsers = await readUsersFromStorage();

        const exists = allUsers.find(u => u.phone === phone);
        if (exists) {
            return { success: false, message: 'Số điện thoại này đã được đăng ký' };
        }

        const newUser: User = {
            id: `user-${Date.now()}`,
            name,
            phone,
            password,
            role: 'user',
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        const updatedUsers = [...allUsers, newUser];
        await saveUsers(updatedUsers);

        return { success: true, message: 'Đăng ký thành công! Tài khoản đang chờ Admin duyệt.' };
    };

    const logout = async () => {
        setUser(null);
        await AsyncStorage.removeItem('currentUser');
    };

    const approveUser = async (userId: string) => {
        const latestUsers = await readUsersFromStorage();
        const updatedUsers = latestUsers.map(u =>
            u.id === userId ? { ...u, status: 'approved' as const } : u
        );
        await saveUsers(updatedUsers);
    };

    const rejectUser = async (userId: string) => {
        const latestUsers = await readUsersFromStorage();
        const updatedUsers = latestUsers.map(u =>
            u.id === userId ? { ...u, status: 'rejected' as const } : u
        );
        await saveUsers(updatedUsers);
    };

    const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
        const latestUsers = await readUsersFromStorage();
        const target = latestUsers.find(u => u.id === userId);
        if (!target) {
            return { success: false, message: 'Không tìm thấy người dùng' };
        }
        if (target.role === 'admin') {
            return { success: false, message: 'Không thể xóa tài khoản quản trị' };
        }

        const updatedUsers = latestUsers.filter(u => u.id !== userId);
        await saveUsers(updatedUsers);

        if (user?.id === userId) {
            setUser(null);
            await AsyncStorage.removeItem('currentUser');
        }

        return { success: true, message: `Đã xóa tài khoản "${target.name}"` };
    };

    const changePassword = async (currentPw: string, newPw: string): Promise<{ success: boolean; message: string }> => {
        if (!user) return { success: false, message: 'Chưa đăng nhập' };
        const latestUsers = await readUsersFromStorage();
        const latestCurrent = latestUsers.find(u => u.id === user.id);
        if (!latestCurrent) return { success: false, message: 'Không tìm thấy tài khoản hiện tại' };
        if (latestCurrent.password !== currentPw) return { success: false, message: 'Mật khẩu hiện tại không đúng' };
        if (newPw.length < 6) return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
        const updatedUser = { ...latestCurrent, password: newPw };
        const updatedUsers = latestUsers.map(u => u.id === user.id ? updatedUser : u);
        await saveUsers(updatedUsers);
        setUser(updatedUser);
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return { success: true, message: 'Đổi mật khẩu thành công' };
    };

    return (
        <AuthContext.Provider value={{ user, users, isLoading, login, register, logout, approveUser, rejectUser, deleteUser, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
};
