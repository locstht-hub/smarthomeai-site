import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, PieChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '../constants/colors';
import { useForecast } from '../contexts/ForecastContext';
import { useData } from '../contexts/DataContext';
import { AnomalyAlert } from '../types/forecast';

const screenWidth = Dimensions.get('window').width - 64;

const formatCurrency = (value: number) => value.toLocaleString('vi-VN');
const normalizeConfidence = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const formatConfidence = (value?: number) => `${normalizeConfidence(value)}%`;

const generateReportHTML = (
    rooms: Array<{ name: string; power: number; percent: number }>,
    anomalies: AnomalyAlert[],
    predictions: Array<{ time: string; predictedKw: number; confidence: number }>,
    modelName: string,
) => {
    const now = new Date();
    const totalKwh = predictions.reduce((sum, item) => sum + item.predictedKw, 0);
    const estimatedCost = totalKwh * 3000;

    const anomalyRows = anomalies.map(a => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${a.deviceName} - ${a.roomName}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${a.severity}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${a.message}</td>
            <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${a.detectedAt}</td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
        h1 { color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #334155; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .summary-box { display: flex; gap: 20px; margin: 20px 0; }
        .summary-item { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
        .summary-value { font-size: 28px; font-weight: 700; color: #1e40af; }
        .summary-label { font-size: 13px; color: #64748b; margin-top: 4px; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    </style></head>
    <body>
        <h1>Báo cáo phụ tải điện demo</h1>
        <p><strong>Ngày xuất:</strong> ${now.toLocaleDateString('vi-VN')} &nbsp;&nbsp; <strong>Nguồn:</strong> ${modelName}</p>

        <div class="summary-box">
            <div class="summary-item">
                <div class="summary-value">${totalKwh.toFixed(1)}</div>
                <div class="summary-label">Tổng kW dự báo</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${Math.round(estimatedCost / 1000)}K</div>
                <div class="summary-label">Chi phí ước tính</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${anomalies.length}</div>
                <div class="summary-label">Cảnh báo</div>
            </div>
        </div>

        <h2>Phân bổ theo phòng</h2>
        <table>
            <tr><th>Phòng</th><th>Công suất tức thời (W)</th><th>Tỷ lệ</th></tr>
            ${rooms.map(room => `
                <tr>
                    <td>${room.name}</td>
                    <td>${room.power}W</td>
                    <td>${room.percent}%</td>
                </tr>
            `).join('')}
        </table>

        <h2>Dự báo sắp tới</h2>
        <table>
            <tr><th>Mốc thời gian</th><th>Dự báo (kW)</th><th>Độ tin cậy</th></tr>
            ${predictions.map(item => `
                <tr>
                    <td>${item.time}</td>
                    <td>${item.predictedKw.toFixed(1)}</td>
                    <td>${formatConfidence(item.confidence)}</td>
                </tr>
            `).join('')}
        </table>

        <h2>Cảnh báo bất thường</h2>
        ${anomalies.length ? `<table>
            <tr><th>Thiết bị</th><th>Mức độ</th><th>Mô tả</th><th>Thời gian</th></tr>
            ${anomalyRows}
        </table>` : '<p>Không có cảnh báo bất thường.</p>'}

        <div class="footer">
            <p>Smart Home App + Server API Demo</p>
        </div>
    </body>
    </html>`;
};

export default function AnalysisScreen() {
    const { predictions, anomalies, insights, modelInfo, isLoading, error, refresh, triggerRetrain } = useForecast();
    const { rooms, getTotalPower, getActiveDeviceCount } = useData();
    const [showAnomalyDetail, setShowAnomalyDetail] = useState<AnomalyAlert | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isRetraining, setIsRetraining] = useState(false);

    const totalPowerKw = Number((getTotalPower() / 1000).toFixed(1));
    const activeCount = getActiveDeviceCount();

    const pieData = useMemo(() => {
        const total = rooms.reduce((sum, room) => sum + room.power, 0) || 1;
        const palette = [Colors.primary[500], Colors.green[500], Colors.amber[500], Colors.purple[500]];

        return rooms.map((room, index) => ({
            name: room.name,
            value: room.power || 1,
            color: palette[index % palette.length],
            legendFontColor: Colors.slate[600],
            legendFontSize: 12,
            percent: Math.round((room.power / total) * 100),
        }));
    }, [rooms]);

    const lineChartData = useMemo(() => {
        const labels = predictions.map(pred => pred.time.replace('Trong ', '+').replace(' giờ', 'h'));
        const forecastSeries = predictions.map(pred => pred.predictedKw);
        const actualSeries = predictions.map((pred, index) => index === 0 ? totalPowerKw : Number(((pred.predictedKw + totalPowerKw) / 2).toFixed(1)));

        return {
            labels,
            datasets: [
                { data: actualSeries, color: () => Colors.primary[500], strokeWidth: 2 },
                { data: forecastSeries, color: () => Colors.purple[500], strokeWidth: 2 },
            ],
            legend: ['Hiện tại', 'Dự báo'],
        };
    }, [predictions, totalPowerKw]);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const html = generateReportHTML(
                pieData.map(room => ({ name: room.name, power: Number(room.value), percent: room.percent })),
                anomalies,
                predictions,
                modelInfo.name,
            );
            const { uri } = await Print.printToFileAsync({ html, base64: false });
            await Sharing.shareAsync(uri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'Chia sẻ báo cáo phụ tải',
            });
        } catch (exportError: unknown) {
            const message = exportError instanceof Error ? exportError.message : '';
            if (!message.includes('cancel') && !message.includes('dismiss')) {
                Alert.alert('Lỗi', 'Không thể tạo báo cáo PDF. Vui lòng thử lại.');
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleRetrain = async () => {
        if (!triggerRetrain) {
            Alert.alert('Không hỗ trợ', 'Tính năng này chỉ khả dụng khi kết nối với máy chủ AI (Flask).');
            return;
        }

        Alert.alert(
            'Bắt đầu Tái huấn luyện',
            'He thong se tai du lieu 30 ngay gan nhat tu server rieng va chay luong Online Learning ngam o may chu bien (Edge Device). Vui long xac nhan?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Kích hoạt',
                    style: 'default',
                    onPress: async () => {
                        setIsRetraining(true);
                        const success = await triggerRetrain();
                        setIsRetraining(false);
                        if (success) {
                            Alert.alert('Thành công', 'Đã gửi tín hiệu Tái huấn luyện xuống máy chủ Edge thành công. Mô hình đang tự động cập nhật cấu trúc dưới nền!');
                        } else {
                            Alert.alert('Lỗi', 'Không thể kích hoạt luồng tái huấn luyện.');
                        }
                    },
                },
            ]
        );
    };

    const severityConfig = {
        critical: { icon: '🔴', label: 'Nghiêm trọng', bg: Colors.red[50], border: Colors.red[200], text: Colors.red[600] },
        warning: { icon: '🟡', label: 'Cảnh báo', bg: Colors.amber[50], border: Colors.amber[200], text: Colors.amber[700] },
        info: { icon: '🔵', label: 'Thông tin', bg: Colors.blue[50], border: Colors.blue[200], text: Colors.blue[600] },
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.pageTitle}>Phân tích & Dự báo</Text>
            <Text style={styles.pageSubtitle}>
                {isLoading ? 'Dang cap nhat tu server rieng...' : `Nguồn: ${modelInfo.name}`}
            </Text>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{error}</Text>
                </View>
            )}

            <TouchableOpacity onPress={handleExportPDF} disabled={isExporting} activeOpacity={0.7}>
                <LinearGradient colors={[Colors.green[500], Colors.green[700]]} style={styles.exportBtn}>
                    <Text style={{ fontSize: 18 }}>📄</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.exportBtnTitle}>{isExporting ? 'Đang tạo báo cáo...' : 'Xuất báo cáo PDF'}</Text>
                        <Text style={styles.exportBtnSub}>Lấy từ forecast provider đang hoạt động</Text>
                    </View>
                    <Text style={{ fontSize: 16, color: '#fff' }}>→</Text>
                </LinearGradient>
            </TouchableOpacity>

            <LinearGradient colors={[Colors.primary[600], Colors.primary[800]]} style={styles.aiCard}>
                <View style={styles.aiCardCircle1} />
                <View style={styles.aiCardCircle2} />
                <View style={{ zIndex: 1 }}>
                    <View style={styles.aiStatusRow}>
                        <View style={styles.aiDot} />
                        <Text style={styles.aiStatusText}>Forecast provider đã sẵn sàng</Text>
                    </View>
                    <View style={styles.aiMetrics}>
                        <View>
                            <Text style={styles.aiMetricLabel}>Phụ tải hiện tại</Text>
                            <View style={styles.aiValueRow}>
                                <Text style={styles.aiValue}>{totalPowerKw.toFixed(1)}</Text>
                                <Text style={styles.aiUnit}>kW</Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.aiMetricLabel}>Thiết bị hoạt động</Text>
                            <Text style={styles.aiMape}>{activeCount}</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                    <Text style={{ fontSize: 14 }}>⚡</Text>
                    <Text style={styles.metricSub}>Dự báo gần nhất</Text>
                    <Text style={styles.metricValue}>
                        {predictions[0]?.predictedKw.toFixed(1) || '0.0'} <Text style={styles.metricUnit}>kW</Text>
                    </Text>
                    <Text style={styles.metricChange}>{formatConfidence(predictions[0]?.confidence)} tin cậy</Text>
                </View>
                <View style={styles.metricCard}>
                    <Text style={{ fontSize: 14 }}>💰</Text>
                    <Text style={styles.metricSub}>Chi phí ước tính</Text>
                    <Text style={styles.metricValue}>
                        {Math.round((predictions.reduce((sum, item) => sum + item.predictedKw, 0) * 3000) / 1000)}K <Text style={styles.metricUnit}>đ</Text>
                    </Text>
                    <Text style={styles.metricChange}>Cập nhật theo provider hiện tại</Text>
                </View>
            </View>

            <View style={styles.chartCard}>
                <View style={styles.predHeader}>
                    <Text style={styles.chartTitle}>Phụ tải điện năng</Text>
                    <TouchableOpacity onPress={() => refresh().catch(() => undefined)}>
                        <Text style={styles.predUpdate}>Làm mới</Text>
                    </TouchableOpacity>
                </View>
                <LineChart
                    data={lineChartData}
                    width={screenWidth}
                    height={200}
                    yAxisSuffix=" kW"
                    chartConfig={{
                        backgroundColor: '#fff',
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                        labelColor: () => Colors.slate[500],
                        propsForDots: { r: '3' },
                    }}
                    bezier
                    style={{ borderRadius: 12 }}
                />
            </View>

            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Phân bổ tiêu thụ theo phòng</Text>
                <PieChart
                    data={pieData}
                    width={screenWidth}
                    height={180}
                    chartConfig={{ color: () => '#000' }}
                    accessor="value"
                    backgroundColor="transparent"
                    paddingLeft="10"
                />
            </View>

            <View style={styles.anomalySection}>
                <Text style={styles.chartTitle}>Cảnh báo bất thường</Text>
                {anomalies.length === 0 ? (
                    <View style={styles.noAnomalyBox}>
                        <Text style={styles.noAnomalyText}>Không có cảnh báo bất thường từ provider hiện tại.</Text>
                    </View>
                ) : anomalies.map((alert) => {
                    const config = severityConfig[alert.severity];
                    const powerIncrease = alert.currentPower && alert.normalPower
                        ? Math.round(((alert.currentPower - alert.normalPower) / alert.normalPower) * 100)
                        : null;

                    return (
                        <TouchableOpacity
                            key={alert.id}
                            style={[styles.anomalyCard, { borderColor: config.border, backgroundColor: config.bg }]}
                            onPress={() => setShowAnomalyDetail(alert)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.anomalyCardTop}>
                                <View style={styles.anomalyCardLeft}>
                                    <Text style={{ fontSize: 16 }}>{config.icon}</Text>
                                    <View>
                                        <Text style={styles.anomalyDevice}>{alert.deviceName} - {alert.roomName}</Text>
                                        <Text style={[styles.anomalySeverity, { color: config.text }]}>{config.label}</Text>
                                    </View>
                                </View>
                                {powerIncrease !== null && (
                                    <View style={styles.anomalyPowerBadge}>
                                        <Text style={[styles.anomalyPowerText, { color: Colors.red[600] }]}>+{powerIncrease}%</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.anomalyMessage}>{alert.message}</Text>
                            <View style={styles.anomalyFooter}>
                                <Text style={styles.anomalyPower}>
                                    {alert.currentPower && alert.normalPower ? `${alert.currentPower}W / ${alert.normalPower}W bình thường` : 'Không có số liệu công suất'}
                                </Text>
                                <Text style={styles.anomalyTime}>{new Date(alert.detectedAt).toLocaleString('vi-VN')}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.chartCard}>
                <View style={styles.predHeader}>
                    <Text style={styles.chartTitle}>Dự báo sắp tới</Text>
                    <Text style={styles.predUpdate}>{modelInfo.mode === 'demo_rule' ? 'Demo rule' : 'Model thật'}</Text>
                </View>
                {predictions.map((pred, index) => (
                    <View key={`${pred.time}-${index}`} style={styles.predItem}>
                        <View style={styles.predLeft}>
                            <View style={styles.predIcon}><Text>🕐</Text></View>
                            <View>
                                <Text style={styles.predTime}>{pred.time}</Text>
                                <View style={styles.predConfRow}>
                                    <View style={styles.predBarBg}>
                                        <View style={[styles.predBarFill, { width: `${normalizeConfidence(pred.confidence)}%` }]} />
                                    </View>
                                    <Text style={styles.predConfText}>{formatConfidence(pred.confidence)} tin cậy</Text>
                                </View>
                            </View>
                        </View>
                        <View>
                            <Text style={styles.predValue}>{pred.predictedKw.toFixed(1)} <Text style={styles.predUnit}>kW</Text></Text>
                        </View>
                    </View>
                ))}
            </View>

            <Text style={[styles.chartTitle, { marginTop: 16 }]}>Gợi ý tiết kiệm</Text>
            {insights.map((insight) => (
                <View key={insight.id} style={[styles.insightCard, { borderColor: Colors.amber[200], backgroundColor: Colors.amber[50] }]}>
                    <Text style={{ fontSize: 16 }}>💡</Text>
                    <View style={{ flex: 1 }}>
                        <View style={styles.insightHeader}>
                            <Text style={styles.insightTitle}>{insight.title}</Text>
                            {insight.value ? <Text style={[styles.insightBadge, { color: Colors.amber[600] }]}>{insight.value}</Text> : null}
                        </View>
                        <Text style={styles.insightText}>{insight.detail}</Text>
                    </View>
                </View>
            ))}

            <View style={styles.modelCard}>
                <Text style={styles.modelTitle}>Thông tin mô hình dự báo</Text>
                <View style={styles.modelGrid}>
                    <View style={styles.modelItem}><Text style={styles.modelLabel}>Nguồn</Text><Text style={styles.modelValue2}>{modelInfo.name}</Text></View>
                    <View style={styles.modelItem}><Text style={styles.modelLabel}>Chế độ</Text><Text style={styles.modelValue2}>{modelInfo.mode}</Text></View>
                    <View style={styles.modelItem}><Text style={styles.modelLabel}>Lần cập nhật cuối</Text><Text style={styles.modelValue2}>{new Date(modelInfo.lastUpdated).toLocaleString('vi-VN')}</Text></View>
                    <View style={styles.modelItem}><Text style={styles.modelLabel}>Mẫu huấn luyện</Text><Text style={styles.modelValue2}>{modelInfo.trainingSamples ?? 'Chưa có'}</Text></View>
                </View>
                <TouchableOpacity
                    style={[styles.retrainBtn, isRetraining && { opacity: 0.7 }]}
                    onPress={() => { void handleRetrain(); }}
                    disabled={isRetraining}
                >
                    <Text style={styles.retrainBtnIcon}>🔄</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.retrainBtnText}>{isRetraining ? 'Đang gửi tín hiệu...' : 'Tái huấn luyện (Retrain)'}</Text>
                        <Text style={styles.retrainBtnSub}>Kích hoạt luồng học tăng cường (Online Learning)</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />

            <Modal visible={!!showAnomalyDetail} transparent animationType="slide" onRequestClose={() => setShowAnomalyDetail(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {showAnomalyDetail && (() => {
                            const config = severityConfig[showAnomalyDetail.severity];
                            const powerIncrease = showAnomalyDetail.currentPower && showAnomalyDetail.normalPower
                                ? Math.round(((showAnomalyDetail.currentPower - showAnomalyDetail.normalPower) / showAnomalyDetail.normalPower) * 100)
                                : null;
                            return (
                                <>
                                    <View style={styles.modalHeader}>
                                        <Text style={{ fontSize: 24 }}>{config.icon}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalTitle}>{showAnomalyDetail.deviceName}</Text>
                                            <Text style={styles.modalSubtitle}>{showAnomalyDetail.roomName}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setShowAnomalyDetail(null)}>
                                            <Text style={{ fontSize: 22, color: Colors.slate[400] }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.modalSeverityBadge, { backgroundColor: config.bg, borderColor: config.border }]}>
                                        <Text style={[styles.modalSeverityText, { color: config.text }]}>{config.label}: {showAnomalyDetail.message}</Text>
                                    </View>

                                    <Text style={styles.modalDetail}>{showAnomalyDetail.detail || 'Cảnh báo này được sinh từ provider hiện tại.'}</Text>

                                    <View style={styles.modalStats}>
                                        <View style={styles.modalStatItem}>
                                            <Text style={styles.modalStatLabel}>Công suất hiện tại</Text>
                                            <Text style={[styles.modalStatValue, { color: Colors.red[600] }]}>{showAnomalyDetail.currentPower ?? '--'}W</Text>
                                        </View>
                                        <View style={styles.modalStatItem}>
                                            <Text style={styles.modalStatLabel}>Công suất bình thường</Text>
                                            <Text style={[styles.modalStatValue, { color: Colors.green[600] }]}>{showAnomalyDetail.normalPower ?? '--'}W</Text>
                                        </View>
                                        <View style={styles.modalStatItem}>
                                            <Text style={styles.modalStatLabel}>Mức tăng</Text>
                                            <Text style={[styles.modalStatValue, { color: Colors.red[600] }]}>{powerIncrease !== null ? `+${powerIncrease}%` : '--'}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.modalRecommendTitle}>Khuyến nghị xử lý:</Text>
                                    <Text style={styles.modalRecommendItem}>1. Kiem tra lai trang thai thiet bi tren server/PLC.</Text>
                                    <Text style={styles.modalRecommendItem}>2. So sánh phụ tải hiện tại với mức nền của cùng khung giờ.</Text>
                                    <Text style={styles.modalRecommendItem}>3. Khi có model thật, giữ nguyên UI này và chỉ thay forecast provider.</Text>

                                    <Text style={styles.modalTime}>Phát hiện: {new Date(showAnomalyDetail.detectedAt).toLocaleString('vi-VN')}</Text>
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
    pageTitle: { fontSize: 22, fontWeight: '600', color: Colors.slate[800], marginTop: 8 },
    pageSubtitle: { fontSize: 13, color: Colors.slate[500], marginBottom: 14 },
    errorBanner: { backgroundColor: Colors.red[50], borderWidth: 1, borderColor: Colors.red[200], borderRadius: 12, padding: 12, marginBottom: 14 },
    errorBannerText: { fontSize: 13, color: Colors.red[600] },
    exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 14 },
    exportBtnTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
    exportBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    anomalySection: { marginBottom: 14 },
    chartTitle: { fontSize: 16, fontWeight: '600', color: Colors.slate[800], marginBottom: 12 },
    noAnomalyBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colors.slate[200], padding: 14 },
    noAnomalyText: { fontSize: 13, color: Colors.slate[500] },
    anomalyCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
    anomalyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    anomalyCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    anomalyDevice: { fontSize: 14, fontWeight: '600', color: Colors.slate[800] },
    anomalySeverity: { fontSize: 11, fontWeight: '500', marginTop: 1 },
    anomalyPowerBadge: { backgroundColor: Colors.red[50], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    anomalyPowerText: { fontSize: 12, fontWeight: '700' },
    anomalyMessage: { fontSize: 13, color: Colors.slate[600], marginBottom: 8 },
    anomalyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    anomalyPower: { fontSize: 11, color: Colors.slate[500] },
    anomalyTime: { fontSize: 11, color: Colors.slate[400] },
    aiCard: { borderRadius: 20, padding: 20, marginBottom: 14, overflow: 'hidden' },
    aiCardCircle1: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.1)' },
    aiCardCircle2: { position: 'absolute', bottom: -30, left: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)' },
    aiStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green[400] },
    aiStatusText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    aiMetrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    aiMetricLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
    aiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    aiValue: { fontSize: 38, fontWeight: '700', color: '#fff' },
    aiUnit: { fontSize: 18, color: '#fff' },
    aiMape: { fontSize: 24, fontWeight: '600', color: '#fff' },
    metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    metricSub: { fontSize: 11, color: Colors.slate[500], marginTop: 4 },
    metricValue: { fontSize: 22, fontWeight: '700', color: Colors.slate[800], marginTop: 4 },
    metricUnit: { fontSize: 14, fontWeight: '400', color: Colors.slate[500] },
    metricChange: { fontSize: 11, color: Colors.green[500], marginTop: 4 },
    chartCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    predHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    predUpdate: { fontSize: 11, color: Colors.slate[400] },
    predItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: Colors.slate[50], borderRadius: 12, marginBottom: 8 },
    predLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    predIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primary[100], alignItems: 'center', justifyContent: 'center' },
    predTime: { fontSize: 14, fontWeight: '500', color: Colors.slate[800] },
    predConfRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    predBarBg: { width: 60, height: 6, borderRadius: 3, backgroundColor: Colors.slate[200], overflow: 'hidden' },
    predBarFill: { height: '100%', backgroundColor: Colors.primary[500], borderRadius: 3 },
    predConfText: { fontSize: 11, color: Colors.slate[500] },
    predValue: { fontSize: 18, fontWeight: '700', color: Colors.slate[800] },
    predUnit: { fontSize: 13, fontWeight: '400', color: Colors.slate[500] },
    insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
    insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    insightTitle: { fontSize: 14, fontWeight: '500', color: Colors.slate[800] },
    insightBadge: { fontSize: 11, fontWeight: '600' },
    insightText: { fontSize: 13, color: Colors.slate[600], lineHeight: 18 },
    modelCard: { backgroundColor: Colors.slate[800], borderRadius: 14, padding: 16, marginTop: 6 },
    modelTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
    modelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    modelItem: { width: '46%' as const },
    modelLabel: { fontSize: 12, color: Colors.slate[400], marginBottom: 2 },
    modelValue2: { fontSize: 14, fontWeight: '500', color: '#fff' },
    retrainBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)', borderRadius: 12, padding: 12, marginTop: 16 },
    retrainBtnIcon: { fontSize: 18 },
    retrainBtnText: { fontSize: 13, fontWeight: '600', color: Colors.blue[400] },
    retrainBtnSub: { fontSize: 11, color: Colors.slate[400], marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.slate[800] },
    modalSubtitle: { fontSize: 13, color: Colors.slate[500] },
    modalSeverityBadge: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 14 },
    modalSeverityText: { fontSize: 13, fontWeight: '600' },
    modalDetail: { fontSize: 14, color: Colors.slate[600], lineHeight: 22, marginBottom: 16 },
    modalStats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    modalStatItem: { flex: 1, backgroundColor: Colors.slate[50], borderRadius: 10, padding: 12, alignItems: 'center' },
    modalStatLabel: { fontSize: 11, color: Colors.slate[500], marginBottom: 4, textAlign: 'center' },
    modalStatValue: { fontSize: 18, fontWeight: '700' },
    modalRecommendTitle: { fontSize: 14, fontWeight: '600', color: Colors.slate[800], marginBottom: 8 },
    modalRecommendItem: { fontSize: 13, color: Colors.slate[600], lineHeight: 22, paddingLeft: 4 },
    modalTime: { fontSize: 12, color: Colors.slate[400], marginTop: 16, textAlign: 'right' },
});
