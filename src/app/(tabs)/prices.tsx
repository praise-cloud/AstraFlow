import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/services/api';
import { LineChart } from '@/components/LineChart';
import { Sparkline } from '@/components/Sparkline';

type PriceDay = { date: string; label: string; petrol: number; diesel: number };
type Summary = { avg: number; min: number; max: number; change: number };

function calcSummary(values: number[]): Summary {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, change: 0 };
  return {
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    change: ((values[values.length - 1] - values[0]) / values[0]) * 100,
  };
}

const MOCK_DATA: PriceDay[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const base = 64 + Math.sin(i / 3) * 4 + (i / 30) * 3;
  return {
    date: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    petrol: parseFloat(base.toFixed(3)),
    diesel: parseFloat((base * 1.085 + Math.cos(i / 4) * 3).toFixed(3)),
  };
});

export default function PricesScreen() {
  const [history, setHistory] = useState<PriceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<'petrol' | 'diesel'>('petrol');

  const fetchHistory = useCallback(async () => {
    setError(null);
    try {
      const res = await api.prices.history();
      setHistory(res);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError('⚠ Unable to load price history — showing offline data');
      setHistory(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.prices.history();
      setHistory(res);
    } catch { /* ignore */ }
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchHistory(); }, []);

  const currentData = history.map(d => ({ label: d.label, value: d[selectedFuel] }));
  const summary = calcSummary(currentData.map(d => d.value));
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const earliest = history.length > 0 ? history[0] : null;

  const petrolChanges = history.map((d, i) => ({
    label: d.label,
    change: i === 0 ? 0 : d.petrol - history[i - 1].petrol,
  }));
  const dieselChanges = history.map((d, i) => ({
    label: d.label,
    change: i === 0 ? 0 : d.diesel - history[i - 1].diesel,
  }));
  const petrolSpark = history.map(d => d.petrol);
  const dieselSpark = history.map(d => d.diesel);
  const petrolSummary = calcSummary(history.map(d => d.petrol));
  const dieselSummary = calcSummary(history.map(d => d.diesel));

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
          <TouchableOpacity style={styles.errorBanner} onPress={fetchHistory}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedFuel === 'petrol' && styles.toggleActive]}
            onPress={() => setSelectedFuel('petrol')}
          >
            <Text style={[styles.toggleText, selectedFuel === 'petrol' && styles.toggleTextActive]}>
              Petrol
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selectedFuel === 'diesel' && styles.toggleActive]}
            onPress={() => setSelectedFuel('diesel')}
          >
            <Text style={[styles.toggleText, selectedFuel === 'diesel' && styles.toggleTextActive]}>
              Diesel
            </Text>
          </TouchableOpacity>
        </View>

        {latest && earliest && (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceUnit}>Current Price</Text>
                <Text style={styles.priceValue}>Rs {latest[selectedFuel].toFixed(2)}</Text>
              </View>
              <Sparkline
                data={currentData.map(d => d.value)}
                width={80}
                height={32}
                color={selectedFuel === 'petrol' ? '#003087' : '#d32f2f'}
              />
            </View>
            <View style={styles.changeContainer}>
              <Text style={[styles.changeText, { color: summary.change >= 0 ? '#d32f2f' : '#2e7d32' }]}>
                {summary.change >= 0 ? '↑' : '↓'} {Math.abs(summary.change).toFixed(1)}% (30 days)
              </Text>
            </View>
          </View>
        )}

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Price Trend — 30 Days</Text>
          <LineChart
            data={currentData}
            color={selectedFuel === 'petrol' ? '#003087' : '#d32f2f'}
            fillColor={selectedFuel === 'petrol' ? 'rgba(0,48,135,0.06)' : 'rgba(211,47,47,0.06)'}
          />
        </View>

        <View style={styles.statsGrid}>
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

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#003087' }]} />
            <Text style={styles.legendText}>Petrol</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#d32f2f' }]} />
            <Text style={styles.legendText}>Diesel</Text>
          </View>
        </View>

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
              <Text style={styles.changeCardLabel}>30d change</Text>
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
              <Text style={styles.changeCardLabel}>30d change</Text>
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
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c4c6d4',
    alignItems: 'center',
  },
  toggleActive: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#747683' },
  toggleTextActive: { color: '#003087' },
  priceCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 20, gap: 8,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceUnit: { fontSize: 12, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  priceValue: { fontSize: 28, fontWeight: '700', color: '#1a1c1e' },
  changeContainer: { flexDirection: 'row', alignItems: 'center' },
  changeText: { fontSize: 13, fontWeight: '600' },
  chartCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, alignItems: 'center',
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#444652', marginBottom: 8, alignSelf: 'flex-start' },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#dee5ef',
    padding: 12, alignItems: 'center', gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1a1c1e' },
  legendRow: { flexDirection: 'row', gap: 24, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#747683' },
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
