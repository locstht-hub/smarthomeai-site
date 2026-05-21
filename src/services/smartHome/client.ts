import { Device } from '../../constants/data';
import { SmartHomeServerConfig, PowerCurrentResponse } from '../../types/smartHomeServer';

interface DevicesResponse {
    devices: Record<string, Device[]>;
}

interface ChatResponse {
    reply?: string;
    text?: string;
    message?: string;
}

const DEFAULT_TIMEOUT = 8000;

export class SmartHomeApiClient {
    private readonly config: SmartHomeServerConfig;

    constructor(config: SmartHomeServerConfig) {
        this.config = config;
    }

    isReady(): boolean {
        return Boolean(this.config.apiBaseUrl.trim());
    }

    async health(): Promise<{ ok: boolean; service?: string }> {
        return this.request('/health');
    }

    async getPowerCurrent(): Promise<PowerCurrentResponse> {
        return this.request('/api/power/current');
    }

    async getDevices(): Promise<Record<string, Device[]>> {
        const response = await this.request<DevicesResponse>('/api/devices');
        return response.devices;
    }

    async setDeviceState(deviceId: string, isOn: boolean): Promise<void> {
        await this.request(`/api/devices/${encodeURIComponent(deviceId)}/${isOn ? 'turn-on' : 'turn-off'}`, {
            method: 'POST',
        });
    }

    async applyScene(scene: string): Promise<void> {
        await this.request(`/api/scenes/${encodeURIComponent(scene)}`, {
            method: 'POST',
        });
    }

    async chat(text: string): Promise<string> {
        const response = await this.request<ChatResponse>('/api/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
        return response.reply || response.text || response.message || 'Server da nhan lenh cua ban.';
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const baseUrl = this.config.apiBaseUrl.trim().replace(/\/+$/, '');
        if (!baseUrl) {
            throw new Error('Server API chua duoc cau hinh');
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout || DEFAULT_TIMEOUT);

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...((init.headers as Record<string, string>) || {}),
            };

            if (this.config.apiToken?.trim()) {
                headers.Authorization = `Bearer ${this.config.apiToken.trim()}`;
            }

            const response = await fetch(`${baseUrl}${path}`, {
                ...init,
                headers,
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `Server API tra ve ma ${response.status}`);
            }

            return response.json() as Promise<T>;
        } finally {
            clearTimeout(timer);
        }
    }
}

