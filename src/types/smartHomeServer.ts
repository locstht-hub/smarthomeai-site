export interface SmartHomeServerConfig {
    apiBaseUrl: string;
    apiToken?: string;
    forecastApiUrl?: string;
    forecastModel?: 'xgboost' | 'lstm';
    timeout?: number;
}

export type SmartHomeServerStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface PowerCurrentResponse {
    voltage: number | null;
    current: number | null;
    power_kw: number | null;
    energy_kwh: number | null;
    timestamp: string;
    source?: string;
}

