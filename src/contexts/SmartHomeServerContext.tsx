import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SmartHomeApiClient } from '../services/smartHome/client';
import { SmartHomeServerConfig, SmartHomeServerStatus } from '../types/smartHomeServer';

interface SmartHomeServerContextType {
    config: SmartHomeServerConfig;
    status: SmartHomeServerStatus;
    error: string | null;
    isConfigured: boolean;
    client: SmartHomeApiClient;
    saveConfig: (nextConfig: SmartHomeServerConfig) => Promise<void>;
    testConnection: (overrideConfig?: SmartHomeServerConfig) => Promise<{ success: boolean; message: string }>;
}

const SmartHomeServerContext = createContext<SmartHomeServerContextType>({} as SmartHomeServerContextType);

const STORAGE_KEY = 'smartHomeServerConfig';

const defaultConfig: SmartHomeServerConfig = {
    apiBaseUrl: 'https://api.smarthomeai.id.vn',
    apiToken: '',
    forecastApiUrl: '',
    forecastModel: 'xgboost',
    timeout: 8000,
};

const normalizeConfig = (nextConfig: SmartHomeServerConfig): SmartHomeServerConfig => ({
    apiBaseUrl: nextConfig.apiBaseUrl.trim(),
    apiToken: nextConfig.apiToken?.trim() || '',
    forecastApiUrl: nextConfig.forecastApiUrl?.trim() || '',
    forecastModel: nextConfig.forecastModel || 'xgboost',
    timeout: nextConfig.timeout || 8000,
});

export const useSmartHomeServer = () => useContext(SmartHomeServerContext);

export const SmartHomeServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<SmartHomeServerConfig>(defaultConfig);
    const [status, setStatus] = useState<SmartHomeServerStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    setConfig(normalizeConfig(JSON.parse(saved)));
                }
            } catch (storageError) {
                console.error('Error loading Smart Home server config', storageError);
            }
        };

        loadConfig();
    }, []);

    const client = useMemo(() => new SmartHomeApiClient(config), [config]);
    const isConfigured = Boolean(config.apiBaseUrl.trim());

    const testConnection = useCallback(async (overrideConfig?: SmartHomeServerConfig) => {
        const effectiveConfig = normalizeConfig(overrideConfig || config);
        const effectiveClient = new SmartHomeApiClient(effectiveConfig);

        if (!effectiveConfig.apiBaseUrl.trim()) {
            const message = 'Chua cau hinh Server API';
            setStatus('error');
            setError(message);
            return { success: false, message };
        }

        setStatus('connecting');
        setError(null);
        try {
            await effectiveClient.health();
            setStatus('connected');
            return { success: true, message: 'Ket noi Server API thanh cong' };
        } catch (connectionError) {
            const message = connectionError instanceof Error ? connectionError.message : 'Khong the ket noi Server API';
            setStatus('error');
            setError(message);
            return { success: false, message };
        }
    }, [config]);

    const saveConfig = useCallback(async (nextConfig: SmartHomeServerConfig) => {
        const normalized = normalizeConfig(nextConfig);
        setConfig(normalized);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }, []);

    return (
        <SmartHomeServerContext.Provider value={{ config, status, error, isConfigured, client, saveConfig, testConnection }}>
            {children}
        </SmartHomeServerContext.Provider>
    );
};
