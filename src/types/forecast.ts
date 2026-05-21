export type ForecastSource = 'server_rule' | 'flask_model' | 'mock_fallback';

export interface PredictionPoint {
    time: string;
    predictedKw: number;
    confidence: number;
    source: ForecastSource;
}

export interface AnomalyAlert {
    id: string;
    deviceName: string;
    roomName: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    detail?: string;
    currentPower?: number;
    normalPower?: number;
    detectedAt: string;
    source: Exclude<ForecastSource, 'mock_fallback'> | 'mock_fallback';
}

export interface Insight {
    id: string;
    title: string;
    detail: string;
    value?: string;
    source: Exclude<ForecastSource, 'mock_fallback'> | 'mock_fallback';
}

export interface ModelInfo {
    name: string;
    lastUpdated: string;
    trainingSamples?: number;
    mode: 'demo_rule' | 'real_model';
}

export interface ForecastProvider {
    getPredictions(): Promise<PredictionPoint[]>;
    getAnomalies(): Promise<AnomalyAlert[]>;
    getInsights(): Promise<Insight[]>;
    getModelInfo(): Promise<ModelInfo>;
    triggerRetrain?(): Promise<boolean>;
}
