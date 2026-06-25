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
  return Array.from({ length: Math.max(days, 2) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (Math.max(days, 2) - 1 - i));
    const base = 64 + Math.sin(i / 3) * 4 + (i / Math.max(days, 2)) * 3;
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      petrol: parseFloat(base.toFixed(3)),
      diesel: parseFloat((base * 1.085 + Math.cos(i / 4) * 3).toFixed(3)),
    };
  });
}

function calcDailyChanges(data: PriceDay[], key: 'petrol' | 'diesel') {
  return data.map((d, i) => ({
    label: d.label,
    change: i === 0 ? 0 : d[key] - data[i - 1][key],
  }));
}

export default function PricesScreen() {
  const [history, setHistory] = useState<PriceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<'petrol' | 'diesel'>('petrol');
  const [selectedDays, setSelectedDays] = useState(30);

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

  const currentData = history.map(d => ({ label: d.label, value: d[selectedFuel] }));
  const summary = calcSummary(currentData.map(d => d.value));
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const earliest = history.length > 0 ? history[0] : null;

  const petrolChanges = useMemo(() => calcDailyChanges(history, 'petrol'), [history]);
  const dieselChanges = useMemo(() => calcDailyChanges(history, 'diesel'), [history]);
  const petrolSpark = history.map(d => d.petrol);
  const dieselSpark = history.map(d => d.diesel);
  const petrolSummary = calcSummary(history.map(d => d.petrol));
  const dieselSummary = calcSummary(history.map(d => d.diesel));

  const spread = latest ? latest.diesel - latest.petrol : 0;
  const spreadPct = latest && latest.petrol > 0 ? (spread / latest.petrol) * 100 : 0;

  const biggestUp = useMemo(() => {
    const all = [...petrolChanges.slice(1), ...dieselChanges.slice(1)];
    const max = Math.max(...all.map(d => d.change));
    const entry = all.find(d => d.change === max);
    return entry || null;
  }, [petrolChanges, dieselChanges]);

  const biggestDown = useMemo(() => {
    const all = [...petrolChanges.slice(1), ...dieselChanges.slice(1)];
    const min = Math.min(...all.map(d => d.change));
    const entry = all.find(d => d.change === min);
    return entry || null;
  }, [petrolChanges, dieselChanges]);

  const volatility = useMemo(() => {
    const allPrices = [...history.flatMap(d => [d.petrol, d.diesel])];
    if (allPrices.length === 0) return 0;
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    const range = Math.max(...allPrices) - Math.min(...allPrices);
    return avg > 0 ? (range / avg) * 100 : 0;
  }, [history]);

  const weeklyTrend = useMemo(() => {
    if (history.length < 4) return null;
    const mid = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, mid);
    const secondHalf = history.slice(mid);
    const firstAvgP = firstHalf.reduce((s, d) => s + d.petrol, 0) / firstHalf.length;
    const secondAvgP = secondHalf.reduce((s, d) => s + d.petrol, 0) / secondHalf.length;
    const firstAvgD = firstHalf.reduce((s, d) => s + d.diesel, 0) / firstHalf.length;
    const secondAvgD = secondHalf.reduce((s, d) => s + d.diesel, 0) / secondHalf.length;
    return {
      petrol: firstAvgP > 0 ? ((secondAvgP - firstAvgP) / firstAvgP) * 100 : 0,
      diesel: firstAvgD > 0 ? ((secondAvgD - firstAvgD) / firstAvgD) * 100 : 0,
    };
  }, [history]);

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
            <Text style={[styles.fuelText, selectedFuel === 'petrol' && styles.fuelTextActive]}>
              Petrol
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fuelBtn, selectedFuel === 'diesel' && styles.fuelBtnActive]}
            onPress={() => setSelectedFuel('diesel')}
          >
            <Text style={[styles.fuelText, selectedFuel === 'diesel' && styles.fuelTextActive]}>
              Diesel
            </Text>
          </TouchableOpacity>
        </View>

        {latest && earliest && (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>Current Price</Text>
                <Text style={styles.priceValue}>Rs {latest[selectedFuel].toFixed(2)}</Text>
              </View>
              <Sparkline
                data={currentData.map(d => d.value)}
                width={80}
                height={32}
                color={selectedFuel === 'petrol' ? '#003087' : '#d32f2f'}
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
          <Text style={styles.chartTitle}>Price Trend — {rangeLabel}</Text>
          <LineChart
            data={currentData}
            color={selectedFuel === 'petrol' ? '#003087' : '#d32f2f'}
            fillColor={selectedFuel === 'petrol' ? 'rgba(0,48,135,0.06)' : 'rgba(211,47,47,0.06)'}
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
            <Text style={styles.infoIcon}>📏</Text>
            <Text style={styles.infoLabel}>Petrol vs Diesel</Text>
            <Text style={styles.infoValue}>Rs {spread.toFixed(2)}</Text>
            <Text style={styles.infoSub}>Diesel costs {spreadPct.toFixed(1)}% more</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📊</Text>
            <Text style={styles.infoLabel}>Volatility</Text>
            <Text style={styles.infoValue}>{volatility.toFixed(1)}%</Text>
            <Text style={styles.infoSub}>Price range / avg</Text>
          </View>
        </View>

        <View style={styles.infoGrid2}>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📈</Text>
            <Text style={styles.infoLabel}>Biggest Jump</Text>
            <Text style={[styles.infoValue, { color: '#d32f2f' }]}>
              {biggestUp ? `Rs ${biggestUp.change.toFixed(3)}` : '—'}
            </Text>
            <Text style={styles.infoSub}>{biggestUp?.label || ''}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📉</Text>
            <Text style={styles.infoLabel}>Biggest Drop</Text>
            <Text style={[styles.infoValue, { color: '#2e7d32' }]}>
              {biggestDown ? `Rs ${biggestDown.change.toFixed(3)}` : '—'}
            </Text>
            <Text style={styles.infoSub}>{biggestDown?.label || ''}</Text>
          </View>
        </View>

        {weeklyTrend && (
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyTitle}>Mid-Period Comparison</Text>
            <View style={styles.weeklyRow}>
              <View style={styles.weeklyItem}>
                <Text style={styles.weeklyLabel}>Petrol</Text>
                <Text style={[styles.weeklyValue, { color: weeklyTrend.petrol >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                  {weeklyTrend.petrol >= 0 ? '↑' : '↓'} {Math.abs(weeklyTrend.petrol).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.weeklyDivider} />
              <View style={styles.weeklyItem}>
                <Text style={styles.weeklyLabel}>Diesel</Text>
                <Text style={[styles.weeklyValue, { color: weeklyTrend.diesel >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                  {weeklyTrend.diesel >= 0 ? '↑' : '↓'} {Math.abs(weeklyTrend.diesel).toFixed(1)}%
                </Text>
              </View>
            </View>
            <Text style={styles.weeklySub}>2nd half vs 1st half avg</Text>
          </View>
        )}

        <View style={styles.changeCardsRow}>
          <View style={[styles.changeCard, { borderTopColor: '#003087' }]}>
            <View style={styles.changeCardHeader}>
              <Text style={styles.changeCardFuel}>Petrol</Text>
              <Text style={styles.changeCardPrice}>Rs {petrolSummary.avg.toFixed(2)}</Text>
            </View>
            <View style={styles.changeCardTrend}>
              <Text style={[styles.changeCardPct, { color: petrolSummary.change >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                {petrolSummary.change >= 0 ? '↑' : '↓'} {Math.abs(petrolSummary.change).toFixed(1)}%
              </Text>
              <Text style={styles.changeCardLabel}>{rangeLabel} change</Text>
            </View>
            <Sparkline data={petrolSpark} width={140} height={36} color="#003087" />
            <View style={styles.barGroup}>
              {petrolChanges.slice(-10).map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.changeBar,
                    {
                      backgroundColor: d.change > 0 ? '#ffcdd2' : d.change < 0 ? '#c8e6c9' : '#e0e0e0',
                      height: Math.min(Math.abs(d.change) * 6, 24) + 4,
                    },
                  ]}
                />
              ))}
              <Text style={styles.barLabel}>Daily Δ</Text>
            </View>
            <View style={styles.changeStats}>
              <Text style={styles.changeStat}>H: Rs {petrolSummary.max.toFixed(2)}</Text>
              <Text style={styles.changeStat}>L: Rs {petrolSummary.min.toFixed(2)}</Text>
            </View>
          </View>

          <View style={[styles.changeCard, { borderTopColor: '#d32f2f' }]}>
            <View style={styles.changeCardHeader}>
              <Text style={styles.changeCardFuel}>Diesel</Text>
              <Text style={styles.changeCardPrice}>Rs {dieselSummary.avg.toFixed(2)}</Text>
            </View>
            <View style={styles.changeCardTrend}>
              <Text style={[styles.changeCardPct, { color: dieselSummary.change >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                {dieselSummary.change >= 0 ? '↑' : '↓'} {Math.abs(dieselSummary.change).toFixed(1)}%
              </Text>
              <Text style={styles.changeCardLabel}>{rangeLabel} change</Text>
            </View>
            <Sparkline data={dieselSpark} width={140} height={36} color="#d32f2f" />
            <View style={styles.barGroup}>
              {dieselChanges.slice(-10).map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.changeBar,
                    {
                      backgroundColor: d.change > 0 ? '#ffcdd2' : d.change < 0 ? '#c8e6c9' : '#e0e0e0',
                      height: Math.min(Math.abs(d.change) * 6, 24) + 4,
                    },
                  ]}
                />
              ))}
              <Text style={styles.barLabel}>Daily Δ</Text>
            </View>
            <View style={styles.changeStats}>
              <Text style={styles.changeStat}>H: Rs {dieselSummary.max.toFixed(2)}</Text>
              <Text style={styles.changeStat}>L: Rs {dieselSummary.min.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Days</Text>
            {history.slice(-7).reverse().map((day) => (
              <View key={day.date} style={styles.historyRow}>
                <Text style={styles.historyDate}>{day.label}</Text>
                <View style={styles.historyBars}>
                  <View style={styles.historyBarGroup}>
                    <View style={[styles.historyBar, styles.petrolBar, { flex: day.petrol }]} />
                    <Text style={styles.historyPrice}>Rs {day.petrol.toFixed(3)}</Text>
                  </View>
                  <View style={styles.historyBarGroup}>
                    <View style={[styles.historyBar, styles.dieselBar, { flex: day.diesel }]} />
                    <Text style={styles.historyPrice}>Rs {day.diesel.toFixed(3)}</Text>
                  </View>
                </View>
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
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c4c6d4',
    alignItems: 'center',
  },
  fuelBtnActive: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
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
    padding: 16, gap: 10,
  },
  weeklyTitle: { fontSize: 13, fontWeight: '700', color: '#1a1c1e', textTransform: 'uppercase' },
  weeklyRow: { flexDirection: 'row', alignItems: 'center' },
  weeklyItem: { flex: 1, alignItems: 'center', gap: 2 },
  weeklyDivider: { width: 1, height: 24, backgroundColor: '#dee5ef' },
  weeklyLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  weeklyValue: { fontSize: 18, fontWeight: '700' },
  weeklySub: { fontSize: 10, color: '#747683', textAlign: 'center' },

  changeCardsRow: { flexDirection: 'row', gap: 8 },
  changeCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1,
    borderColor: '#dee5ef', borderTopWidth: 3, padding: 12, gap: 8,
  },
  changeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeCardFuel: { fontSize: 13, fontWeight: '700', color: '#1a1c1e', textTransform: 'uppercase' },
  changeCardPrice: { fontSize: 16, fontWeight: '600', color: '#1a1c1e' },
  changeCardTrend: { alignItems: 'flex-start' },
  changeCardPct: { fontSize: 18, fontWeight: '700' },
  changeCardLabel: { fontSize: 10, color: '#747683', textTransform: 'uppercase' },
  barGroup: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 30,
    paddingBottom: 14, position: 'relative',
  },
  changeBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  barLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    fontSize: 9, color: '#747683', textAlign: 'center',
  },
  changeStats: { flexDirection: 'row', justifyContent: 'space-between' },
  changeStat: { fontSize: 11, color: '#747683' },

  historySection: { gap: 4 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1e', marginBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  historyDate: { width: 56, fontSize: 12, fontWeight: '600', color: '#747683' },
  historyBars: { flex: 1, gap: 4 },
  historyBarGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyBar: { height: 10, borderRadius: 4, maxWidth: '80%' },
  petrolBar: { backgroundColor: '#003087', opacity: 0.7 },
  dieselBar: { backgroundColor: '#d32f2f', opacity: 0.7 },
  historyPrice: { width: 60, fontSize: 11, color: '#444652', textAlign: 'right' },
});
