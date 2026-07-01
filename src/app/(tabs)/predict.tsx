import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { api } from '@/services/api';
import { LineChart } from '@/components/LineChart';
import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';

type ForecastData = {
  fuel_type: string;
  current_price: number;
  forecast_days: number;
  trend: string;
  change_pct: number;
  avg_forecast: number;
  min_forecast: number;
  max_forecast: number;
  confidence_interval: { lower: number; upper: number };
  points: Array<{ date: string; label: string; predicted: number; lower_bound: number; upper_bound: number }>;
  recommendation: { action: string; title: string; message: string; urgency: string };
  model: string;
};

export default function PredictScreen() {
  const colors = useAppColor();
  const { t } = useTranslation();
  const [liters, setLiters] = useState('');
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState<'petrol' | 'diesel'>('petrol');
  const [refreshing, setRefreshing] = useState(false);

  const TREND_COLORS: Record<string, string> = {
    up: colors.trendUp,
    down: colors.trendDown,
    stable: colors.trendStable,
  };

  const fetchForecast = useCallback(async (fuel: string) => {
    try {
      const res = await api.predict.forecast(30, fuel);
      setForecast(res);
    } catch {
      // fallback handled in render
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast(selectedFuel);
  }, [selectedFuel]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchForecast(selectedFuel);
    setRefreshing(false);
  }, [selectedFuel, fetchForecast]);

  const handleCalculate = async () => {
    const val = parseFloat(liters);
    if (!val || val <= 0) {
      setError(t('predict.enterValidVolume'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.predict.get(val);
      setResult(res);
      setShowResult(true);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      const ppl = forecast?.current_price || 64;
      const fallback = {
        liters: val, price_per_liter: ppl, total_cost: parseFloat((val * ppl).toFixed(2)),
        carbon_footprint_kg: parseFloat((val * 2.3).toFixed(2)),
        price_index: forecast?.trend ? forecast.trend.charAt(0).toUpperCase() + forecast.trend.slice(1) : 'Stable', price_alert: false, alert_message: null,
        future_increase_pct: forecast?.change_pct || 0, future_loss: 0,
        forecast: { avg_forecast_price: forecast?.avg_forecast || ppl, trend: forecast?.trend || 'stable', model: 'local', recommendation: forecast?.recommendation || { action: 'monitor', title: 'No Data', message: '', urgency: 'none' } },
      };
      setResult(fallback);
      setShowResult(true);
      setError(t('predict.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const chartData = forecast?.points.map(p => ({ label: p.label, value: p.predicted })) || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics-outline" size={22} color={colors.accentPetrol} />
          <Text style={[styles.headerTitle, { color: colors.accentPetrol }]}>{t('predict.header')}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {error && !loading && (
          <View style={[styles.errorBanner, { backgroundColor: colors.bgError }]}>
            <Text style={[styles.errorText, { color: colors.textError }]}>{error}</Text>
          </View>
        )}

        <View style={[styles.forecastCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.fuelToggle}>
            <TouchableOpacity
              style={[
                styles.fuelBtn,
                { backgroundColor: colors.bg, borderColor: colors.borderInput },
                selectedFuel === 'petrol' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight },
              ]}
              onPress={() => setSelectedFuel('petrol')}
            >
              <Text style={[styles.fuelBtnText, { color: colors.textMuted }, selectedFuel === 'petrol' && { color: colors.accentPetrol }]}>{t('common.petrol')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fuelBtn,
                { backgroundColor: colors.bg, borderColor: colors.borderInput },
                selectedFuel === 'diesel' && { borderColor: colors.accentDiesel, backgroundColor: colors.bgPrimaryLight },
              ]}
              onPress={() => setSelectedFuel('diesel')}
            >
              <Text style={[styles.fuelBtnText, { color: colors.textMuted }, selectedFuel === 'diesel' && { color: colors.accentDiesel }]}>{t('common.diesel')}</Text>
            </TouchableOpacity>
          </View>

          {forecastLoading ? (
            <View style={styles.forecastLoading}>
              <ActivityIndicator size="small" color={colors.accentPetrol} />
              <Text style={[styles.forecastLoadingText, { color: colors.textMuted }]}>{t('predict.runningModel')}</Text>
            </View>
          ) : forecast ? (
            <>
              <View style={styles.forecastHeader}>
                <View>
                  <Text style={[styles.forecastLabel, { color: colors.textMuted }]}>{t('predict.forecast30d')}</Text>
                  <Text style={[styles.forecastPrice, { color: colors.textPrimary }]}>
                    Rs {forecast.avg_forecast.toFixed(3)}
                    <Text style={[styles.forecastUnit, { color: colors.textMuted }]}> {t('predict.perLitreAvg')}</Text>
                  </Text>
                </View>
                <View style={[styles.trendBadge, { backgroundColor: TREND_COLORS[forecast.trend] + '20' }]}>
                  <Text style={[styles.trendBadgeText, { color: TREND_COLORS[forecast.trend] }]}>
                    {forecast.trend === 'up' ? '↑' : forecast.trend === 'down' ? '↓' : '→'} {Math.abs(forecast.change_pct).toFixed(1)}%
                  </Text>
                </View>
              </View>

              <LineChart
                data={chartData}
                color={selectedFuel === 'petrol' ? colors.accentPetrol : colors.trendUp}
                fillColor={(selectedFuel === 'petrol' ? colors.accentPetrol : colors.trendUp) + '0f'}
              />

              <View style={styles.forecastMeta}>
                <Text style={[styles.modelLabel, { color: colors.textMuted }]}>{t('predict.modelInfo', { model: forecast.model })}</Text>
              </View>

              {forecast.recommendation.urgency !== 'none' && (
                <View style={[styles.recCard, { backgroundColor: colors.bgSurface, borderLeftColor: TREND_COLORS[forecast.trend] }]}>
                  <Text style={[styles.recTitle, { color: colors.textPrimary }]}>{forecast.recommendation.title}</Text>
                  <Text style={[styles.recText, { color: colors.textSecondary }]}>{forecast.recommendation.message}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.noDataText, { color: colors.textMuted }]}>{t('predict.noForecast')}</Text>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('predict.current')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {forecast?.current_price.toFixed(3) || '—'}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('predict.min')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {forecast?.min_forecast.toFixed(3) || '—'}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('predict.max')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {forecast?.max_forecast.toFixed(3) || '—'}</Text>
          </View>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.bgCard, borderColor: colors.borderInput }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('predict.yourConsumption')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bg }]}
              placeholder={t('predict.consumptionPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={liters}
              onChangeText={(v) => { setLiters(v); setError(null); }}
              keyboardType="numeric"
              editable={!loading}
            />
            <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{t('common.litre')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.calcButton, { backgroundColor: colors.accentPetrol }, (!liters || loading) && styles.buttonDisabled]}
            onPress={handleCalculate}
            disabled={!liters || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textWhite} />
            ) : (
              <>
                <Text style={[styles.calcButtonText, { color: colors.textWhite }]}>{t('predict.projectMyCosts')}</Text>
                <Ionicons name="analytics-outline" size={20} color={colors.textWhite} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {showResult && result && (
          <View style={styles.resultSection}>
            <View style={[styles.resultCard, { backgroundColor: colors.accentPetrol }]}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={[styles.resultLabel, { color: colors.textWhite, opacity: 0.8 }]}>
                    {result.forecast.trend === 'up' ? t('predict.projectedCost') : t('predict.currentCost')}
                  </Text>
                  <Text style={[styles.resultPrice, { color: colors.textWhite }]}>Rs {result.total_cost.toFixed(2)}</Text>
                </View>
                <View style={[styles.resultIconContainer, { backgroundColor: colors.textWhite + '1a' }]}>
                  <Ionicons name="cash-outline" size={24} color={colors.accentPetrol} />
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.textWhite + '1a' }]} />
              <View style={styles.resultGrid}>
                <View>
                  <Text style={[styles.resultGridLabel, { color: colors.textWhite, opacity: 0.7 }]}>{t('predict.pricePerL')}</Text>
                  <Text style={[styles.resultGridValue, { color: colors.textWhite }]}>Rs {result.price_per_liter.toFixed(3)}</Text>
                </View>
                <View>
                  <Text style={[styles.resultGridLabel, { color: colors.textWhite, opacity: 0.7 }]}>{t('predict.carbon')}</Text>
                  <Text style={[styles.resultGridValue, { color: colors.textWhite }]}>{result.carbon_footprint_kg.toFixed(1)} kg</Text>
                </View>
                <View>
                  <Text style={[styles.resultGridLabel, { color: colors.textWhite, opacity: 0.7 }]}>{t('predict.forecastDelta')}</Text>
                  <Text style={[styles.resultGridValue, { color: result.future_increase_pct > 0 ? colors.trendUp : colors.trendDown }]}>
                    {result.future_increase_pct > 0 ? '+' : ''}{result.future_increase_pct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>

            {result.forecast.recommendation.urgency !== 'none' && (
              <View style={[styles.alertCard, { backgroundColor: colors.bgError + '4d', borderColor: colors.textError + '1a', borderLeftColor: result.future_increase_pct > 3 ? colors.trendUp : colors.trendStable }]}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.trendUp} />
                <Text style={[styles.alertText, { color: colors.textError }]}>{result.forecast.recommendation.message}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13 },
  forecastCard: { borderRadius: 12, borderWidth: 1, padding: 20, gap: 16 },
  fuelToggle: { flexDirection: 'row', gap: 8 },
  fuelBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  fuelBtnText: { fontSize: 13, fontWeight: '600' },
  forecastLoading: { alignItems: 'center', padding: 32, gap: 8 },
  forecastLoadingText: { fontSize: 13 },
  forecastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  forecastLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  forecastPrice: { fontSize: 24, fontWeight: '700' },
  forecastUnit: { fontSize: 12, fontWeight: '400' },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  trendBadgeText: { fontSize: 12, fontWeight: '700' },
  forecastMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelLabel: { fontSize: 11, fontStyle: 'italic' },
  recCard: { borderRadius: 8, borderLeftWidth: 4, padding: 14, gap: 4 },
  recTitle: { fontSize: 14, fontWeight: '600' },
  recText: { fontSize: 13, lineHeight: 18 },
  noDataText: { textAlign: 'center', padding: 24 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '700' },
  inputCard: { borderRadius: 12, borderWidth: 1, padding: 24, gap: 12 },
  inputLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  inputRow: { position: 'relative' },
  input: { height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, fontSize: 16, paddingRight: 40 },
  inputSuffix: { position: 'absolute', right: 16, top: 14, fontSize: 14, fontWeight: '600' },
  calcButton: { height: 48, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonDisabled: { opacity: 0.6 },
  calcButtonText: { fontSize: 16, fontWeight: '600' },
  resultSection: { gap: 12 },
  resultCard: { borderRadius: 12, padding: 24, gap: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  resultPrice: { fontSize: 32, fontWeight: '700' },
  resultIconContainer: { padding: 8, borderRadius: 8 },
  divider: { height: 1 },
  resultGrid: { flexDirection: 'row', gap: 24 },
  resultGridLabel: { fontSize: 12, marginBottom: 2 },
  resultGridValue: { fontSize: 16, fontWeight: '600' },
  alertCard: { borderRadius: 8, padding: 16, borderLeftWidth: 4, borderWidth: 1, gap: 4 },
  alertText: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
});
