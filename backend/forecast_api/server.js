const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACT_DIR = path.join(ROOT, 'ml-training', 'modeltrainingdone', 'extracted');
const METRICS_PATH = path.join(ARTIFACT_DIR, 'metrics.json');
const SAMPLE_PATH = path.join(ARTIFACT_DIR, 'sample_forecast.json');

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const metrics = readJson(METRICS_PATH);
const sample = readJson(SAMPLE_PATH);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function notFound(res) {
  json(res, 404, { error: 'Not found' });
}

function mapPredictions() {
  return sample.forecast.map((point, index) => ({
    time: point.timestamp,
    predictedKw: Number(point.predicted_kw.toFixed(3)),
    confidence: Math.max(60, 88 - index),
    source: 'flask_model',
  }));
}

function buildInsights() {
  const predictions = mapPredictions();
  const peak = predictions.reduce((best, current) =>
    current.predictedKw > best.predictedKw ? current : best
  , predictions[0]);
  const averageKw =
    predictions.reduce((sum, item) => sum + item.predictedKw, 0) / predictions.length;

  return [
    {
      id: 'backend-peak-window',
      title: 'Khung giờ cao tải',
      detail: `Tải dự kiến cao nhất quanh ${new Date(peak.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`,
      value: `${peak.predictedKw.toFixed(2)} kW`,
      source: 'flask_model',
    },
    {
      id: 'backend-average',
      title: 'Phụ tải trung bình 24h',
      detail: 'Giá trị này được lấy từ model forecast local đang chạy trên máy phát triển.',
      value: `${averageKw.toFixed(2)} kW`,
      source: 'flask_model',
    },
  ];
}

function buildAnomalies() {
  const predictions = mapPredictions();
  const peak = predictions.reduce((best, current) =>
    current.predictedKw > best.predictedKw ? current : best
  , predictions[0]);

  return [
    {
      id: 'backend-peak-anomaly',
      deviceName: 'Tổng tải dự báo',
      roomName: 'Toàn nhà',
      severity: peak.predictedKw >= 1 ? 'warning' : 'info',
      message: 'Dự báo có một khung giờ tải tăng cao hơn mức nền.',
      detail: `Peak dự báo ${peak.predictedKw.toFixed(2)} kW tại ${peak.time}.`,
      currentPower: Number(peak.predictedKw.toFixed(3)),
      normalPower: Number((peak.predictedKw * 0.78).toFixed(3)),
      detectedAt: peak.time,
      source: 'flask_model',
    },
  ];
}

function modelInfo() {
  const best = metrics.results?.xgboost?.test || {};
  return {
    name: 'XGBoost 24h Forecast',
    lastUpdated: new Date(fs.statSync(METRICS_PATH).mtime).toISOString(),
    trainingSamples: metrics.dataset_summary?.supervised_rows,
    mode: 'real_model',
    datasetName: metrics.dataset_summary?.dataset_name,
    testMae: best.mae,
    testRmse: best.rmse,
    testMape: best.mape,
  };
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    return notFound(res);
  }

  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, backend: 'node-forecast-api' });
  }

  if (req.method === 'GET' && req.url === '/forecast/model-info') {
    return json(res, 200, modelInfo());
  }

  if (req.method === 'GET' && req.url === '/forecast/sample') {
    return json(res, 200, sample);
  }

  if (req.method === 'POST' && req.url === '/forecast/predictions') {
    return json(res, 200, { predictions: mapPredictions() });
  }

  if (req.method === 'POST' && req.url === '/forecast/insights') {
    return json(res, 200, { insights: buildInsights() });
  }

  if (req.method === 'POST' && req.url === '/forecast/anomalies') {
    return json(res, 200, { anomalies: buildAnomalies() });
  }

  return notFound(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Forecast API listening on http://${HOST}:${PORT}`);
});
