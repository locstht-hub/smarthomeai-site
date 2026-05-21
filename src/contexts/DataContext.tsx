import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultRooms, Device, ActivityLog } from '../constants/data';
import { useAuth } from './AuthContext';
import { useSmartHomeServer } from './SmartHomeServerContext';
import { buildFallbackHouseDevices, HouseDevices, normalizeServerDevices } from '../services/smartHome/mappers';

interface ComputedRoom {
    id: string;
    name: string;
    devices: number;
    active: number;
    power: number;
}

interface DataContextType {
    rooms: ComputedRoom[];
    devices: HouseDevices;
    activityLogs: ActivityLog[];
    isServerControlled: boolean;
    refresh: () => Promise<void>;
    toggleDevice: (roomId: string, deviceId: string, targetUserId?: string) => Promise<void>;
    addDevice: (roomId: string, device: Omit<Device, 'id' | 'ownerId'>, targetUserId?: string) => Promise<void>;
    deleteDevice: (roomId: string, deviceId: string, targetUserId?: string) => Promise<void>;
    turnAllOff: (targetUserId?: string) => Promise<void>;
    turnAllOn: (roomId: string, targetUserId?: string) => Promise<void>;
    turnAllOffRoom: (roomId: string, targetUserId?: string) => Promise<void>;
    getTotalPower: (targetUserId?: string) => number;
    getActiveDeviceCount: (targetUserId?: string) => number;
    getUserDevices: (roomId: string, targetUserId?: string) => Device[];
    getRoomsForUser: (targetUserId?: string) => ComputedRoom[];
    getHouseDeviceCount: (targetUserId?: string) => number;
    applyScene: (scene: 'morning' | 'work' | 'weekend' | 'sleep', targetUserId?: string) => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

const DEVICES_STORAGE_KEY = 'sharedHouseDevices';
const ACTIVITY_LOGS_STORAGE_KEY = 'activityLogs';
const SERVER_DEVICES_REFRESH_MS = 30000;

export const useData = () => useContext(DataContext);

const getRoomsForHouse = (house: HouseDevices): ComputedRoom[] => {
    return defaultRooms.map(baseRoom => {
        const roomDevices = house[baseRoom.id] || [];
        const activeDevices = roomDevices.filter(device => device.isOn);
        return {
            id: baseRoom.id,
            name: baseRoom.name,
            devices: roomDevices.length,
            active: activeDevices.length,
            power: activeDevices.reduce((sum, device) => sum + device.power, 0),
        };
    });
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { client, isConfigured } = useSmartHomeServer();
    const [devices, setDevices] = useState<HouseDevices>(buildFallbackHouseDevices());
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
    const [isServerControlled, setIsServerControlled] = useState(false);

    useEffect(() => {
        const loadPersistedData = async () => {
            try {
                const [savedDevices, savedLogs] = await Promise.all([
                    AsyncStorage.getItem(DEVICES_STORAGE_KEY),
                    AsyncStorage.getItem(ACTIVITY_LOGS_STORAGE_KEY),
                ]);

                if (savedDevices) {
                    setDevices(JSON.parse(savedDevices));
                }
                if (savedLogs) {
                    setActivityLogs(JSON.parse(savedLogs));
                }
            } catch (error) {
                console.error('Error loading device cache:', error);
            } finally {
                setHasLoadedStorage(true);
            }
        };

        loadPersistedData();
    }, []);

    useEffect(() => {
        if (!hasLoadedStorage || isServerControlled) return;
        AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices)).catch(error => {
            console.error('Error saving device cache:', error);
        });
    }, [devices, hasLoadedStorage, isServerControlled]);

    useEffect(() => {
        if (!hasLoadedStorage) return;
        AsyncStorage.setItem(ACTIVITY_LOGS_STORAGE_KEY, JSON.stringify(activityLogs)).catch(error => {
            console.error('Error saving activity logs:', error);
        });
    }, [activityLogs, hasLoadedStorage]);

    const addLog = useCallback((action: string, deviceName?: string, roomName?: string) => {
        const log: ActivityLog = {
            id: `log-${Date.now()}`,
            userId: user?.id || 'guest',
            userName: user?.name || 'He thong',
            action,
            device: deviceName,
            room: roomName,
            timestamp: new Date().toISOString(),
        };
        setActivityLogs(prev => [log, ...prev].slice(0, 100));
    }, [user?.id, user?.name]);

    const refresh = useCallback(async () => {
        if (!isConfigured) {
            setIsServerControlled(false);
            return;
        }

        try {
            const nextDevices = await client.getDevices();
            setDevices(normalizeServerDevices(nextDevices));
            setIsServerControlled(true);
        } catch (error) {
            console.error('Error refreshing Smart Home server devices:', error);
            setIsServerControlled(false);
        }
    }, [client, isConfigured]);

    useEffect(() => {
        if (!hasLoadedStorage) return;
        refresh().catch(() => undefined);

        const interval = setInterval(() => {
            refresh().catch(() => undefined);
        }, SERVER_DEVICES_REFRESH_MS);

        return () => clearInterval(interval);
    }, [hasLoadedStorage, refresh]);

    const rooms = useMemo(() => getRoomsForHouse(devices), [devices]);

    const updateLocalHouse = useCallback((updater: (house: HouseDevices) => HouseDevices) => {
        setDevices(prev => updater(prev));
    }, []);

    const getRoomName = useCallback((roomId: string) => {
        return defaultRooms.find(room => room.id === roomId)?.name;
    }, []);

    const toggleDevice = useCallback(async (roomId: string, deviceId: string) => {
        const currentDevice = (devices[roomId] || []).find(device => device.id === deviceId);
        if (!currentDevice) return;

        const nextState = !currentDevice.isOn;

        try {
            if (isConfigured && isServerControlled) {
                await client.setDeviceState(currentDevice.id, nextState);
                await refresh();
            } else {
                updateLocalHouse(house => ({
                    ...house,
                    [roomId]: house[roomId].map(device =>
                        device.id === deviceId ? { ...device, isOn: nextState } : device,
                    ),
                }));
            }

            addLog(currentDevice.isOn ? 'Tat thiet bi' : 'Bat thiet bi', currentDevice.name, getRoomName(roomId));
        } catch (error) {
            console.error('Error toggling device:', error);
            addLog('Loi dieu khien thiet bi', currentDevice.name, getRoomName(roomId));
        }
    }, [addLog, client, devices, getRoomName, isConfigured, isServerControlled, refresh, updateLocalHouse]);

    const addDevice = useCallback(async (roomId: string, device: Omit<Device, 'id' | 'ownerId'>) => {
        if (isServerControlled) {
            addLog('Yeu cau them thiet bi tren server', device.name, getRoomName(roomId));
            return;
        }

        const newDevice: Device = {
            ...device,
            id: `dev-${Date.now()}`,
            source: 'local',
            roomId,
        };

        updateLocalHouse(house => ({
            ...house,
            [roomId]: [...(house[roomId] || []), newDevice],
        }));

        addLog('Them thiet bi moi', newDevice.name, getRoomName(roomId));
    }, [addLog, getRoomName, isServerControlled, updateLocalHouse]);

    const deleteDevice = useCallback(async (roomId: string, deviceId: string) => {
        const currentDevice = (devices[roomId] || []).find(device => device.id === deviceId);
        if (!currentDevice) return;

        if (isServerControlled && currentDevice.source === 'server') {
            addLog('Yeu cau xoa thiet bi tren server', currentDevice.name, getRoomName(roomId));
            return;
        }

        updateLocalHouse(house => ({
            ...house,
            [roomId]: house[roomId].filter(device => device.id !== deviceId),
        }));

        addLog('Xoa thiet bi', currentDevice.name, getRoomName(roomId));
    }, [addLog, devices, getRoomName, isServerControlled, updateLocalHouse]);

    const setAllDevicesState = useCallback(async (roomId: string | null, nextState: boolean): Promise<boolean> => {
        const targetDevices = roomId
            ? devices[roomId] || []
            : Object.values(devices).flat();

        try {
            if (isConfigured && isServerControlled) {
                await Promise.all(targetDevices.map(device => client.setDeviceState(device.id, nextState)));
                await refresh();
            } else {
                updateLocalHouse(house => {
                    if (roomId) {
                        return {
                            ...house,
                            [roomId]: house[roomId].map(device => ({ ...device, isOn: nextState })),
                        };
                    }

                    return Object.keys(house).reduce((acc, currentRoomId) => {
                        acc[currentRoomId] = house[currentRoomId].map(device => ({ ...device, isOn: nextState }));
                        return acc;
                    }, {} as HouseDevices);
                });
            }

            return true;
        } catch (error) {
            console.error('Error setting all devices state:', error);
            return false;
        }
    }, [client, devices, isConfigured, isServerControlled, refresh, updateLocalHouse]);

    const turnAllOff = useCallback(async () => {
        const success = await setAllDevicesState(null, false);
        addLog(success ? 'Tat tat ca thiet bi' : 'Loi tat tat ca thiet bi');
    }, [addLog, setAllDevicesState]);

    const turnAllOn = useCallback(async (roomId: string) => {
        const success = await setAllDevicesState(roomId, true);
        addLog(success ? 'Bat tat ca thiet bi' : 'Loi bat tat ca thiet bi', undefined, getRoomName(roomId));
    }, [addLog, getRoomName, setAllDevicesState]);

    const turnAllOffRoom = useCallback(async (roomId: string) => {
        const success = await setAllDevicesState(roomId, false);
        addLog(success ? 'Tat tat ca thiet bi' : 'Loi tat tat ca thiet bi', undefined, getRoomName(roomId));
    }, [addLog, getRoomName, setAllDevicesState]);

    const applyScene = useCallback(async (scene: 'morning' | 'work' | 'weekend' | 'sleep') => {
        let success = false;

        try {
            if (isConfigured && isServerControlled) {
                await client.applyScene(scene);
                await refresh();
                success = true;
            } else if (scene === 'sleep') {
                updateLocalHouse(house => {
                    return Object.keys(house).reduce((acc, currentRoomId) => {
                        acc[currentRoomId] = house[currentRoomId].map(device => {
                            if (device.type === 'light' || device.type === 'fan') {
                                return { ...device, isOn: false };
                            }
                            return device;
                        });
                        return acc;
                    }, {} as HouseDevices);
                });
                success = true;
            } else {
                const sceneMap: Record<'morning' | 'work' | 'weekend', boolean> = {
                    morning: true,
                    work: false,
                    weekend: true,
                };
                success = await setAllDevicesState(null, sceneMap[scene]);
            }
        } catch (error) {
            console.error('Error applying scene:', error);
        }

        const sceneNames: Record<'morning' | 'work' | 'weekend' | 'sleep', string> = {
            morning: 'Buoi sang',
            work: 'Di lam',
            weekend: 'Cuoi tuan',
            sleep: 'Che do ngu',
        };
        addLog(`${success ? 'Kich hoat canh' : 'Loi kich hoat canh'}: ${sceneNames[scene]}`);
    }, [addLog, client, isConfigured, isServerControlled, refresh, setAllDevicesState, updateLocalHouse]);

    const getTotalPower = useCallback(() => {
        return Object.values(devices).reduce((total, roomDevices) => {
            return total + roomDevices.reduce((roomTotal, device) => roomTotal + (device.isOn ? device.power : 0), 0);
        }, 0);
    }, [devices]);

    const getActiveDeviceCount = useCallback(() => {
        return Object.values(devices).reduce((count, roomDevices) => {
            return count + roomDevices.filter(device => device.isOn).length;
        }, 0);
    }, [devices]);

    const getHouseDeviceCount = useCallback(() => {
        return Object.values(devices).reduce((count, roomDevices) => count + roomDevices.length, 0);
    }, [devices]);

    const getUserDevices = useCallback((roomId: string): Device[] => {
        return devices[roomId] || [];
    }, [devices]);

    const getRoomsForUser = useCallback((): ComputedRoom[] => {
        return rooms;
    }, [rooms]);

    return (
        <DataContext.Provider value={{
            rooms,
            devices,
            activityLogs,
            isServerControlled,
            refresh,
            toggleDevice,
            addDevice,
            deleteDevice,
            turnAllOff,
            turnAllOn,
            turnAllOffRoom,
            getTotalPower,
            getActiveDeviceCount,
            getUserDevices,
            getRoomsForUser,
            getHouseDeviceCount,
            applyScene,
        }}>
            {children}
        </DataContext.Provider>
    );
};
