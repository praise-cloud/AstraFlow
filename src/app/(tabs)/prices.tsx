import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';
import { api } from '@/services/api';
import { LineChart } from '@/components/LineChart';
import { Sparkline } from '@/components/Sparkline';

type PriceDay = { date: string; label: string; petrol: number; diesel: number };
type Summary = { avg: number; min: number; max: number; change: number };

const RANGE_OPTIONS = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

function calcSummary(values: number[]): Summary {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, change: 0 };
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    change: ((values[values.length - 1] - values[0]) / values[0]) * 100,
  };
}

function makeMockData(days: number): PriceDay[] {
  const count = Math.max(days, 2);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const base = 64 + Math.sin(i / 3) * 4 + (i / count) * 3;
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      petrol: parseFloat(base.toFixed(3)),
      diesel: parseFloat((base * 1.085 + Math.cos(i / 4) * 3).toFixed(3)),
    };
  });
}

export default function PricesScreen() {
  const [history, setHistory] = useState<PriceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<'petrol' | 'diesel'>('petrol');
  const [selectedDays, setSelectedDays] = useState(30);

  const colors = useAppColor();
  const { t } = useTranslation();
  const color = selectedFuel === 'petrol' ? colors.accentPetrol : colors.accentDiesel;
  const fuelKey = selectedFuel;
  const otherFuel = selectedFuel === 'petrol' ? 'diesel' : 'petrol';

  const fetchHistory = useCallback(async (days: number) => {
    setError(null);
    try {
      const res = await api.prices.history(days);
      setHistory(res);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(t('prices.errorOffline'));
      setHistory(makeMockData(days));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.prices.history(selectedDays);
      setHistory(res);
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [selectedDays]);

  const handleRangeChange = useCallback((days: number) => {
    setSelectedDays(days);
    setLoading(true);
    fetchHistory(days);
  }, [fetchHistory]);

  useEffect(() => { fetchHistory(selectedDays); }, []);

  const rangeLabel = RANGE_OPTIONS.find(r => r.days === selectedDays)?.label || `${selectedDays}D`;

  const fuelValues = history.map(d => d[fuelKey]);
  const currentData = history.map(d => ({ label: d.label, value: d[fuelKey] }));
  const summary = calcSummary(fuelValues);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const earliest = history.length > 0 ? history[0] : null;

  const dailyChanges = useMemo(() => {
    return history.map((d, i) => ({
      label: d.label,
      change: i === 0 ? 0 : d[fuelKey] - history[i - 1][fuelKey],
    }));
  }, [history, fuelKey]);

  const volatility = useMemo(() => {
    if (fuelValues.length === 0) return 0;
    const avg = fuelValues.reduce((a, b) => a + b, 0) / fuelValues.length;
    const range = Math.max(...fuelValues) - Math.min(...fuelValues);
    return avg > 0 ? (range / avg) * 100 : 0;
  }, [fuelValues]);

  const biggestUp = useMemo(() => {
    const entries = dailyChanges.slice(1);
    if (entries.length === 0) return null;
    const max = Math.max(...entries.map(d => d.change));
    return entries.find(d => d.change === max) || null;
  }, [dailyChanges]);

  const biggestDown = useMemo(() => {
    const entries = dailyChanges.slice(1);
    if (entries.length === 0) return null;
    const min = Math.min(...entries.map(d => d.change));
    return entries.find(d => d.change === min) || null;
  }, [dailyChanges]);

  const weeklyTrend = useMemo(() => {
    if (history.length < 4) return null;
    const mid = Math.floor(history.length / 2);
    const firstHalf = fuelValues.slice(0, mid);
    const secondHalf = fuelValues.slice(mid);
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  }, [fuelValues, history.length]);

  const spread = latest ? latest.diesel - latest.petrol : 0;
  const spreadPct = latest && latest.petrol > 0 ? (spread / latest.petrol) * 100 : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="gas-station-outline" size={22} color={colors.accentPetrol} />
          <Text style={[styles.headerTitle, { color: colors.accentPetrol }]}>{t('prices.header')}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error && (
          <TouchableOpacity style={[styles.errorBanner, { backgroundColor: colors.bgError }]} onPress={() => fetchHistory(selectedDays)}>
            <Text style={[styles.errorText, { color: colors.textError }]}>{error}</Text>
            <Text style={[styles.retryText, { color: colors.textError }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.days}
              style={[
                styles.rangeBtn,
                { backgroundColor: colors.bgCard, borderColor: colors.borderInput },
                selectedDays === opt.days && { backgroundColor: colors.accentPetrol, borderColor: colors.accentPetrol },
              ]}
              onPress={() => handleRangeChange(opt.days)}
            >
              <Text style={[
                styles.rangeText,
                { color: colors.textMuted },
                selectedDays === opt.days && { color: colors.textWhite },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.fuelRow}>
          <TouchableOpacity
            style={[
              styles.fuelBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.borderInput },
              selectedFuel === 'petrol' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight },
            ]}
            onPress={() => setSelectedFuel('petrol')}
          >
            <Ionicons name="flame-outline" size={16} color={selectedFuel === 'petrol' ? colors.accentPetrol : colors.textMuted} />
            <Text style={[
              styles.fuelText,
              { color: colors.textMuted },
              selectedFuel === 'petrol' && { color: colors.accentPetrol },
            ]}>
              {t('common.petrol')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.fuelBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.borderInput },
              selectedFuel === 'diesel' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight },
            ]}
            onPress={() => setSelectedFuel('diesel')}
          >
            <Ionicons name="water-outline" size={16} color={selectedFuel === 'diesel' ? colors.accentPetrol : colors.textMuted} />
            <Text style={[
              styles.fuelText,
              { color: colors.textMuted },
              selectedFuel === 'diesel' && { color: colors.accentPetrol },
            ]}>
              {t('common.diesel')}
            </Text>
          </TouchableOpacity>
        </View>

        {latest && earliest && (
          <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
              <View>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>{t('prices.priceTitle', { fuel: selectedFuel })}</Text>
                <Text style={[styles.priceValue, { color: colors.textPrimary }]}>Rs {latest[fuelKey].toFixed(2)}</Text>
              </View>
              <Sparkline
                data={fuelValues}
                width={80}
                height={32}
                color={color}
              />
            </View>
            <View style={styles.changeRow}>
              <Text style={[styles.changeText, { color: summary.change >= 0 ? colors.trendUp : colors.trendDown }]}>
                <Ionicons name={summary.change >= 0 ? "arrow-up" : "arrow-down"} size={13} color={summary.change >= 0 ? colors.trendUp : colors.trendDown} />
                {' '}{Math.abs(summary.change).toFixed(1)}% ({rangeLabel})
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>{t('prices.priceTrend', { fuel: selectedFuel, range: rangeLabel })}</Text>
          <LineChart
            data={currentData}
            color={color}
            fillColor={color + '0c'}
          />
        </View>

        <View style={styles.statsGrid3}>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('prices.avg')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {summary.avg.toFixed(2)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('prices.low')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {summary.min.toFixed(2)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('prices.high')}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>Rs {summary.max.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid2}>
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="analytics-outline" size={18} color={colors.accentPetrol} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('prices.volatility', { fuel: selectedFuel })}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{volatility.toFixed(1)}%</Text>
            <Text style={[styles.infoSub, { color: colors.textMuted }]}>{t('prices.rangeRelative')}</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="resize-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('prices.dieselVsPetrol')}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Rs {spread.toFixed(2)}</Text>
            <Text style={[styles.infoSub, { color: colors.textMuted }]}>{t('prices.dieselMore', { pct: spreadPct.toFixed(1) })}</Text>
          </View>
        </View>

        <View style={styles.infoGrid2}>
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="trending-up-outline" size={18} color={colors.trendUp} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('prices.biggestJump', { fuel: selectedFuel })}</Text>
            <Text style={[styles.infoValue, { color: colors.trendUp }]}>
              {biggestUp ? `Rs ${biggestUp.change.toFixed(3)}` : '\u2014'}
            </Text>
            <Text style={[styles.infoSub, { color: colors.textMuted }]}>{biggestUp?.label || ''}</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="trending-down-outline" size={18} color={colors.trendDown} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('prices.biggestDrop', { fuel: selectedFuel })}</Text>
            <Text style={[styles.infoValue, { color: colors.trendDown }]}>
              {biggestDown ? `Rs ${biggestDown.change.toFixed(3)}` : '\u2014'}
            </Text>
            <Text style={[styles.infoSub, { color: colors.textMuted }]}>{biggestDown?.label || ''}</Text>
          </View>
        </View>

        {weeklyTrend !== null && (
          <View style={[styles.weeklyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.weeklyTitle, { color: colors.textPrimary }]}>{t('prices.midPeriodShift', { fuel: selectedFuel })}</Text>
            <Text style={[styles.weeklyValue, { color: weeklyTrend >= 0 ? colors.trendUp : colors.trendDown }]}>
              <Ionicons name={weeklyTrend >= 0 ? "arrow-up" : "arrow-down"} size={24} color={weeklyTrend >= 0 ? colors.trendUp : colors.trendDown} />
              {' '}{Math.abs(weeklyTrend).toFixed(1)}%
            </Text>
            <Text style={[styles.weeklySub, { color: colors.textMuted }]}>{t('prices.secondHalfVsFirst')}</Text>
          </View>
        )}

        <View style={[styles.changeCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderTopColor: color }]}>
          <View style={styles.changeCardHeader}>
            <View>
              <Text style={[styles.changeCardFuel, { color: colors.textPrimary }]}>{selectedFuel === 'petrol' ? t('common.petrol') : t('common.diesel')}</Text>
              <Text style={[styles.changeCardPrice, { color: colors.textMuted }]}>{t('prices.rsAvg', { value: summary.avg.toFixed(2) })}</Text>
            </View>
            <View style={styles.changeCardTrend}>
              <Text style={[styles.changeCardPct, { color: summary.change >= 0 ? colors.trendUp : colors.trendDown }]}>
                <Ionicons name={summary.change >= 0 ? "arrow-up" : "arrow-down"} size={20} color={summary.change >= 0 ? colors.trendUp : colors.trendDown} />
                {' '}{Math.abs(summary.change).toFixed(1)}%
              </Text>
              <Text style={[styles.changeCardLabel, { color: colors.textMuted }]}>{rangeLabel === '1D' ? '1D' : rangeLabel === '7D' ? '7D' : rangeLabel === '30D' ? '30D' : '90D'}</Text>
            </View>
          </View>
          <Sparkline data={fuelValues} width={300} height={48} color={color} strokeWidth={2} />
          <Text style={[styles.barTitle, { color: colors.textMuted }]}>{t('prices.dailyChange')}</Text>
          <View style={styles.barGroup}>
            {dailyChanges.slice(-14).map((d, i) => (
              <View key={i} style={styles.barWrapper}>
                <View
                  style={[
                    styles.changeBar,
                    {
                      backgroundColor: d.change > 0 ? colors.trendUp + '20' : d.change < 0 ? colors.trendDown + '20' : colors.border,
                      height: Math.min(Math.abs(d.change) * 8, 32) + 4,
                    },
                  ]}
                />
                {i % 3 === 0 && (
                  <Text style={[styles.barDate, { color: colors.textMuted }]}>{d.label}</Text>
                )}
              </View>
            ))}
          </View>
          <View style={styles.changeStats}>
            <Text style={[styles.changeStat, { color: colors.textMuted }]}>{t('prices.hMax', { value: summary.max.toFixed(2) })}</Text>
            <Text style={[styles.changeStat, { color: colors.textMuted }]}>{t('prices.lMin', { value: summary.min.toFixed(2) })}</Text>
            <Text style={[styles.changeStat, { color: colors.textMuted }]}>{t('prices.rangeStat', { value: (summary.max - summary.min).toFixed(2) })}</Text>
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>{t('prices.recentPrices', { fuel: selectedFuel })}</Text>
            {history.slice(-7).reverse().map((day) => (
              <View key={day.date} style={styles.historyRow}>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>{day.label}</Text>
                <View style={[styles.historyBarTrack, { backgroundColor: colors.bgSurface }]}>
                  <View
                    style={[
                      styles.historyBarFill,
                      {
                        flex: day[fuelKey],
                        backgroundColor: color,
                      },
                    ]}
                  />
                  <Text style={[styles.historyPrice, { color: colors.textPrimary }]}>Rs {day[fuelKey].toFixed(3)}</Text>
                </View>
                <Text style={[styles.historyChange, {
                  color: (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? colors.trendUp : colors.trendDown),
                }]}>
                  {(day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? '+' : '')}
                  {(day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey])).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  headerIcon: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 16 },
  errorBanner: {
    padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', marginLeft: 8 },

  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  rangeBtnActive: {},
  rangeText: { fontSize: 12, fontWeight: '600' },
  rangeTextActive: {},

  fuelRow: { flexDirection: 'row', gap: 8 },
  fuelBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  fuelBtnActive: {},
  fuelIcon: { fontSize: 16 },
  fuelText: { fontSize: 14, fontWeight: '600' },
  fuelTextActive: {},

  priceCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 20, gap: 8,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  priceValue: { fontSize: 28, fontWeight: '700' },
  changeRow: { flexDirection: 'row', alignItems: 'center' },
  changeText: { fontSize: 13, fontWeight: '600' },

  chartCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, alignItems: 'center',
  },
  chartTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, alignSelf: 'flex-start' },

  statsGrid3: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, borderRadius: 8, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700' },

  infoGrid2: { flexDirection: 'row', gap: 8 },
  infoCard: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 4,
  },
  infoIcon: { fontSize: 18 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 20, fontWeight: '700' },
  infoSub: { fontSize: 11 },

  weeklyCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, gap: 4, alignItems: 'center',
  },
  weeklyTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  weeklyValue: { fontSize: 24, fontWeight: '700' },
  weeklySub: { fontSize: 10 },

  changeCard: {
    borderRadius: 12, borderWidth: 1, borderTopWidth: 3, padding: 16, gap: 12,
  },
  changeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  changeCardFuel: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase' },
  changeCardPrice: { fontSize: 13, marginTop: 2 },
  changeCardTrend: { alignItems: 'flex-end' },
  changeCardPct: { fontSize: 20, fontWeight: '700' },
  changeCardLabel: { fontSize: 12, textTransform: 'uppercase' },
  barTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  barGroup: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40,
  },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 40 },
  changeBar: { width: '100%', borderRadius: 3, minHeight: 4 },
  barDate: {
    fontSize: 7, position: 'absolute', bottom: -14,
  },
  changeStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  changeStat: { fontSize: 12 },

  historySection: { gap: 6 },
  historyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  historyDate: { width: 56, fontSize: 12, fontWeight: '600' },
  historyBarTrack: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 12,
    borderRadius: 6, overflow: 'hidden',
  },
  historyBarFill: { height: '100%', borderRadius: 6, opacity: 0.7, minWidth: 4 },
  historyPrice: { position: 'absolute', right: 8, fontSize: 10, fontWeight: '600' },
  historyChange: { width: 50, fontSize: 11, fontWeight: '600', textAlign: 'right' },
});
