import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSmartHomeServer } from './SmartHomeServerContext';
import { AnomalyAlert, Insight, ModelInfo, PredictionPoint } from '../types/forecast';
import { FlaskForecastProvider } from '../services/forecast/flaskForecastProvider';
import { mockAnomalies, mockInsights, mockModelInfo, mockPredictions } from '../services/forecast/mockFallback';

interface ForecastContextType {
    predictions: PredictionPoint[];
    anomalies: AnomalyAlert[];
    insights: Insight[];
    modelInfo: ModelInfo;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    triggerRetrain: () => Promise<boolean>;
}

const ForecastContext = createContext<ForecastContextType>({} as ForecastContextType);
const FORECAST_REFRESH_MS = 5 * 60 * 1000;

export const useForecast = () => useContext(ForecastContext);

export const ForecastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { config } = useSmartHomeServer();
    const [predictions, setPredictions] = useState<PredictionPoint[]>(mockPredictions);
    const [anomalies, setAnomalies] = useState<AnomalyAlert[]>(mockAnomalies);
    const [insights, setInsights] = useState<Insight[]>(mockInsights);
    const [modelInfo, setModelInfo] = useState<ModelInfo>(mockModelInfo);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const flaskProvider = useMemo(() => {
        const apiUrl = config.forecastApiUrl?.trim();
        return apiUrl ? new FlaskForecastProvider(apiUrl, config.forecastModel || 'xgboost') : null;
    }, [config.forecastApiUrl, config.forecastModel]);

    const applyMockFallback = useCallback(() => {
        setPredictions(mockPredictions);
        setAnomalies(mockAnomalies);
        setInsights(mockInsights);
        setModelInfo({
            ...mockModelInfo,
            lastUpdated: new Date().toISOString(),
        });
    }, []);

    const applyProvider = useCallback(async (provider: Pick<FlaskForecastProvider, 'getPredictions' | 'getAnomalies' | 'getInsights' | 'getModelInfo'>) => {
        const [nextPredictions, nextAnomalies, nextInsights, nextModelInfo] = await Promise.all([
            provider.getPredictions(),
            provider.getAnomalies(),
            provider.getInsights(),
            provider.getModelInfo(),
        ]);

        setPredictions(nextPredictions);
        setAnomalies(nextAnomalies);
        setInsights(nextInsights);
        setModelInfo(nextModelInfo);
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (flaskProvider) {
                await applyProvider(flaskProvider);
                return;
            }

            applyMockFallback();
        } catch (providerError) {
            const message = providerError instanceof Error ? providerError.message : 'Khong the doc forecast provider';
            setError(message);
            applyMockFallback();
        } finally {
            setIsLoading(false);
        }
    }, [applyMockFallback, applyProvider, flaskProvider]);

    useEffect(() => {
        refresh().catch(() => undefined);
        const interval = setInterval(() => {
            refresh().catch(() => undefined);
        }, FORECAST_REFRESH_MS);

        return () => clearInterval(interval);
    }, [refresh]);

    const triggerRetrain = useCallback(async () => {
        if (flaskProvider && flaskProvider.triggerRetrain) {
            return await flaskProvider.triggerRetrain();
        }
        return false;
    }, [flaskProvider]);

    return (
        <ForecastContext.Provider value={{ predictions, anomalies, insights, modelInfo, isLoading, error, refresh, triggerRetrain }}>
            {children}
        </ForecastContext.Provider>
    );
};
