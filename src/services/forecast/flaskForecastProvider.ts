import { AnomalyAlert, ForecastProvider, Insight, ModelInfo, PredictionPoint } from '../../types/forecast';

interface PredictionResponse {
    predictions: PredictionPoint[];
}

interface InsightsResponse {
    insights: Insight[];
}

interface AnomaliesResponse {
    anomalies: AnomalyAlert[];
}

interface BackendModelInfo extends ModelInfo {
    datasetName?: string;
    datasetSize?: number;
    testMae?: number;
    testRmse?: number;
    testMape?: number;
}

const DEFAULT_TIMEOUT = 8000;

export class FlaskForecastProvider implements ForecastProvider {
    private readonly baseUrl: string;
    private readonly timeout: number;
    private readonly model: string;

    constructor(baseUrl: string, model: string = 'xgboost', timeout = DEFAULT_TIMEOUT) {
        this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
        this.model = model;
        this.timeout = timeout;
    }

    async getPredictions(): Promise<PredictionPoint[]> {
        const response = await this.request<PredictionResponse>(`/forecast/predictions?model=${this.model}`, {
            method: 'POST',
            body: JSON.stringify({ allow_sample: true }),
        });
        return response.predictions;
    }

    async getAnomalies(): Promise<AnomalyAlert[]> {
        const response = await this.request<AnomaliesResponse>(`/forecast/anomalies?model=${this.model}`, {
            method: 'POST',
            body: JSON.stringify({ allow_sample: true }),
        });
        return response.anomalies;
    }

    async getInsights(): Promise<Insight[]> {
        const response = await this.request<InsightsResponse>(`/forecast/insights?model=${this.model}`, {
            method: 'POST',
            body: JSON.stringify({ allow_sample: true }),
        });
        return response.insights;
    }

    async getModelInfo(): Promise<ModelInfo> {
        const info = await this.request<BackendModelInfo>(`/forecast/model-info?model=${this.model}`);
        return {
            name: info.name || 'Flask Forecast Model',
            lastUpdated: info.lastUpdated || new Date().toISOString(),
            trainingSamples: info.trainingSamples || info.datasetSize,
            mode: 'real_model',
        };
    }

    async triggerRetrain(): Promise<boolean> {
        try {
            const response = await this.request<{ status: string; message: string }>(`/forecast/trigger-retrain?model=${this.model}`, {
                method: 'POST',
            });
            return response.status === 'accepted';
        } catch (error) {
            console.error('Trigger retrain failed:', error);
            return false;
        }
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        if (!this.baseUrl) {
            throw new Error('Forecast API chua duoc cau hinh');
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                headers: {
                    'Content-Type': 'application/json',
                    ...(init.headers || {}),
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `Forecast API tra ve ma ${response.status}`);
            }

            return response.json() as Promise<T>;
        } finally {
            clearTimeout(timer);
        }
    }
}
