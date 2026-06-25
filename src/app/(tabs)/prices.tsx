import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

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

const FUEL_COLORS = { petrol: '#003087', diesel: '#d32f2f' } as const;
const FUEL_ICONS = { petrol: '⛽', diesel: '🛢️' } as const;

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

  const color = FUEL_COLORS[selectedFuel];
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
      setError('⚠ Unable to load price history — showing offline data');
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⛽</Text>
          <Text style={styles.headerTitle}>AstraFlow</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={() => fetchHistory(selectedDays)}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.days}
              style={[styles.rangeBtn, selectedDays === opt.days && styles.rangeBtnActive]}
              onPress={() => handleRangeChange(opt.days)}
            >
              <Text style={[styles.rangeText, selectedDays === opt.days && styles.rangeTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.fuelRow}>
          <TouchableOpacity
            style={[styles.fuelBtn, selectedFuel === 'petrol' && styles.fuelBtnActive]}
            onPress={() => setSelectedFuel('petrol')}
          >
            <Text style={[styles.fuelIcon]}>⛽</Text>
            <Text style={[styles.fuelText, selectedFuel === 'petrol' && styles.fuelTextActive]}>
              Petrol
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fuelBtn, selectedFuel === 'diesel' && styles.fuelBtnActive]}
            onPress={() => setSelectedFuel('diesel')}
          >
            <Text style={[styles.fuelIcon]}>🛢️</Text>
            <Text style={[styles.fuelText, selectedFuel === 'diesel' && styles.fuelTextActive]}>
              Diesel
            </Text>
          </TouchableOpacity>
        </View>

        {latest && earliest && (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>{selectedFuel} Price</Text>
                <Text style={styles.priceValue}>Rs {latest[fuelKey].toFixed(2)}</Text>
              </View>
              <Sparkline
                data={fuelValues}
                width={80}
                height={32}
                color={color}
              />
            </View>
            <View style={styles.changeRow}>
              <Text style={[styles.changeText, { color: summary.change >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                {summary.change >= 0 ? '↑' : '↓'} {Math.abs(summary.change).toFixed(1)}% ({rangeLabel})
              </Text>
            </View>
          </View>
        )}

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{selectedFuel} Price Trend — {rangeLabel}</Text>
          <LineChart
            data={currentData}
            color={color}
            fillColor={color + '0c'}
          />
        </View>

        <View style={styles.statsGrid3}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Avg</Text>
            <Text style={styles.statValue}>Rs {summary.avg.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>Rs {summary.min.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={styles.statValue}>Rs {summary.max.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid2}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📊</Text>
            <Text style={styles.infoLabel}>{selectedFuel} Volatility</Text>
            <Text style={styles.infoValue}>{volatility.toFixed(1)}%</Text>
            <Text style={styles.infoSub}>Range relative to avg</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📏</Text>
            <Text style={styles.infoLabel}>Diesel vs Petrol</Text>
            <Text style={styles.infoValue}>Rs {spread.toFixed(2)}</Text>
            <Text style={styles.infoSub}>Diesel costs {spreadPct.toFixed(1)}% more</Text>
          </View>
        </View>

        <View style={styles.infoGrid2}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📈</Text>
            <Text style={styles.infoLabel}>Biggest {selectedFuel} Jump</Text>
            <Text style={[styles.infoValue, { color: '#d32f2f' }]}>
              {biggestUp ? `Rs ${biggestUp.change.toFixed(3)}` : '—'}
            </Text>
            <Text style={styles.infoSub}>{biggestUp?.label || ''}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📉</Text>
            <Text style={styles.infoLabel}>Biggest {selectedFuel} Drop</Text>
            <Text style={[styles.infoValue, { color: '#2e7d32' }]}>
              {biggestDown ? `Rs ${biggestDown.change.toFixed(3)}` : '—'}
            </Text>
            <Text style={styles.infoSub}>{biggestDown?.label || ''}</Text>
          </View>
        </View>

        {weeklyTrend !== null && (
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyTitle}>{selectedFuel} Mid-Period Shift</Text>
            <Text style={[styles.weeklyValue, { color: weeklyTrend >= 0 ? '#d32f2f' : '#2e7d32' }]}>
              {weeklyTrend >= 0 ? '↑' : '↓'} {Math.abs(weeklyTrend).toFixed(1)}%
            </Text>
            <Text style={styles.weeklySub}>2nd half vs 1st half avg</Text>
          </View>
        )}

        <View style={[styles.changeCard, { borderTopColor: color }]}>
          <View style={styles.changeCardHeader}>
            <View>
              <Text style={styles.changeCardFuel}>{selectedFuel}</Text>
              <Text style={styles.changeCardPrice}>Rs {summary.avg.toFixed(2)} avg</Text>
            </View>
            <View style={styles.changeCardTrend}>
              <Text style={[styles.changeCardPct, { color: summary.change >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                {summary.change >= 0 ? '↑' : '↓'} {Math.abs(summary.change).toFixed(1)}%
              </Text>
              <Text style={styles.changeCardLabel}>{rangeLabel}</Text>
            </View>
          </View>
          <Sparkline data={fuelValues} width={300} height={48} color={color} strokeWidth={2} />
          <Text style={styles.barTitle}>Daily Change</Text>
          <View style={styles.barGroup}>
            {dailyChanges.slice(-14).map((d, i) => (
              <View key={i} style={styles.barWrapper}>
                <View
                  style={[
                    styles.changeBar,
                    {
                      backgroundColor: d.change > 0 ? '#ffcdd2' : d.change < 0 ? '#c8e6c9' : '#e0e0e0',
                      height: Math.min(Math.abs(d.change) * 8, 32) + 4,
                    },
                  ]}
                />
                {i % 3 === 0 && (
                  <Text style={styles.barDate}>{d.label}</Text>
                )}
              </View>
            ))}
          </View>
          <View style={styles.changeStats}>
            <Text style={styles.changeStat}>H: Rs {summary.max.toFixed(2)}</Text>
            <Text style={styles.changeStat}>L: Rs {summary.min.toFixed(2)}</Text>
            <Text style={styles.changeStat}>Range: Rs {(summary.max - summary.min).toFixed(2)}</Text>
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent {selectedFuel} Prices</Text>
            {history.slice(-7).reverse().map((day) => (
              <View key={day.date} style={styles.historyRow}>
                <Text style={styles.historyDate}>{day.label}</Text>
                <View style={styles.historyBarTrack}>
                  <View
                    style={[
                      styles.historyBarFill,
                      {
                        flex: day[fuelKey],
                        backgroundColor: color,
                      },
                    ]}
                  />
                  <Text style={styles.historyPrice}>Rs {day[fuelKey].toFixed(3)}</Text>
                </View>
                <Text style={[styles.historyChange, {
                  color: fuelKey === 'petrol'
                    ? (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? '#d32f2f' : '#2e7d32')
                    : (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? '#d32f2f' : '#2e7d32')
                }]}>
                  {fuelKey === 'petrol'
                    ? (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? '+' : '')
                    : (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey]) >= 0 ? '+' : '')}
                  {fuelKey === 'petrol'
                    ? (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey])).toFixed(2)
                    : (day[fuelKey] - (history[history.indexOf(day) - 1]?.[fuelKey] || day[fuelKey])).toFixed(2)}
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
  container: { flex: 1, backgroundColor: '#f9f9fc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56, backgroundColor: '#f9f9fc',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#003087' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 16 },
  errorBanner: {
    backgroundColor: '#ffdad6', padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, color: '#93000a', flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', color: '#ba1a1a', marginLeft: 8 },

  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c4c6d4',
    alignItems: 'center',
  },
  rangeBtnActive: { borderColor: '#003087', backgroundColor: '#003087' },
  rangeText: { fontSize: 12, fontWeight: '600', color: '#747683' },
  rangeTextActive: { color: '#ffffff' },

  fuelRow: { flexDirection: 'row', gap: 8 },
  fuelBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c4c6d4',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  fuelBtnActive: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  fuelIcon: { fontSize: 16 },
  fuelText: { fontSize: 14, fontWeight: '600', color: '#747683' },
  fuelTextActive: { color: '#003087' },

  priceCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 20, gap: 8,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 12, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  priceValue: { fontSize: 28, fontWeight: '700', color: '#1a1c1e' },
  changeRow: { flexDirection: 'row', alignItems: 'center' },
  changeText: { fontSize: 13, fontWeight: '600' },

  chartCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, alignItems: 'center',
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#444652', marginBottom: 8, alignSelf: 'flex-start' },

  statsGrid3: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#dee5ef',
    padding: 12, alignItems: 'center', gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1c1e' },

  infoGrid2: { flexDirection: 'row', gap: 8 },
  infoCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 14, gap: 4,
  },
  infoIcon: { fontSize: 18 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  infoValue: { fontSize: 20, fontWeight: '700', color: '#1a1c1e' },
  infoSub: { fontSize: 11, color: '#747683' },

  weeklyCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, gap: 4, alignItems: 'center',
  },
  weeklyTitle: { fontSize: 13, fontWeight: '700', color: '#1a1c1e', textTransform: 'uppercase' },
  weeklyValue: { fontSize: 24, fontWeight: '700' },
  weeklySub: { fontSize: 10, color: '#747683' },

  changeCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1,
    borderColor: '#dee5ef', borderTopWidth: 3, padding: 16, gap: 12,
  },
  changeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  changeCardFuel: { fontSize: 15, fontWeight: '700', color: '#1a1c1e', textTransform: 'uppercase' },
  changeCardPrice: { fontSize: 13, color: '#747683', marginTop: 2 },
  changeCardTrend: { alignItems: 'flex-end' },
  changeCardPct: { fontSize: 20, fontWeight: '700' },
  changeCardLabel: { fontSize: 12, color: '#747683', textTransform: 'uppercase' },
  barTitle: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  barGroup: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40,
  },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 40 },
  changeBar: { width: '100%', borderRadius: 3, minHeight: 4 },
  barDate: {
    fontSize: 7, color: '#747683', position: 'absolute', bottom: -14,
  },
  changeStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  changeStat: { fontSize: 12, color: '#747683' },

  historySection: { gap: 6 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1e', marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  historyDate: { width: 56, fontSize: 12, fontWeight: '600', color: '#747683' },
  historyBarTrack: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 12,
    backgroundColor: '#f0f0f3', borderRadius: 6, overflow: 'hidden',
  },
  historyBarFill: { height: '100%', borderRadius: 6, opacity: 0.7, minWidth: 4 },
  historyPrice: { position: 'absolute', right: 8, fontSize: 10, color: '#1a1c1e', fontWeight: '600' },
  historyChange: { width: 50, fontSize: 11, fontWeight: '600', textAlign: 'right' },
});
