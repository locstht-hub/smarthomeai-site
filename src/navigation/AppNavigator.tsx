import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RoomsScreen from '../screens/RoomsScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AdminScreen from '../screens/AdminScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const APP_LOGO = require('../../assets/icon.png');

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
    const icons: Record<string, string> = {
        'Tổng quan': '🏠',
        'Phòng': '🛋️',
        'Phân tích': '📊',
        'Chat': '💬',
        'Cài đặt': '⚙️',
        'Quản lý': '🔧',
    };
    return (
        <View style={{ alignItems: 'center', gap: 2 }}>
            {label === 'Tổng quan' ? (
                <Image source={APP_LOGO} style={{ width: 22, height: 22, borderRadius: 6 }} />
            ) : (
                <Text style={{ fontSize: 20 }}>{icons[label] || '📱'}</Text>
            )}
            <Text style={{ fontSize: 10, fontWeight: focused ? '600' : '400', color: focused ? Colors.primary[600] : Colors.slate[400] }}>{label}</Text>
        </View>
    );
}

function MainTabs() {
    const { user } = useAuth();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    height: 70,
                    paddingBottom: 10,
                    paddingTop: 8,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderTopColor: Colors.slate[200],
                },
                tabBarShowLabel: false,
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Tổng quan" focused={focused} /> }}
            />
            <Tab.Screen
                name="RoomList"
                component={RoomsScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Phòng" focused={focused} /> }}
            />
            <Tab.Screen
                name="Analysis"
                component={AnalysisScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Phân tích" focused={focused} /> }}
            />
            <Tab.Screen
                name="Chat"
                component={ChatScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Chat" focused={focused} /> }}
            />
            {user?.role === 'admin' && (
                <Tab.Screen
                    name="Admin"
                    component={AdminScreen}
                    options={{ tabBarIcon: ({ focused }) => <TabIcon label="Quản lý" focused={focused} /> }}
                />
            )}
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Cài đặt" focused={focused} /> }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
                <Image source={APP_LOGO} style={{ width: 40, height: 40, borderRadius: 10 }} />
                <Text style={{ marginTop: 10, color: Colors.slate[500] }}>Đang tải...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            {user ? (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Main" component={MainTabs} />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
}
