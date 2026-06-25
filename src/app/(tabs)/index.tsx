import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/services/api';
import { getUser } from '@/services/auth';
import { Sparkline } from '@/components/Sparkline';

type DashboardData = {
  current_price: { petrol: number; diesel: number; currency: string; unit: string };
  global_crude?: {
    brent_usd: number | null;
    wti_usd: number | null;
    diesel_global_usd: number | null;
    gasoline_global_usd: number | null;
    updated_at: string | null;
    source: string;
  };
  trend: { petrol: string; petrol_change: number; diesel: string; diesel_change: number };
  risk_level: string;
  impact_score: string;
  recommendation: { title: string; content: string };
  market_update: string;
  business_type: string;
  user_name: string;
};

type OilNews = {
  id: number;
  title: string;
  summary: string;
  content: string;
  source: string;
  image_url: string | null;
  published_at: string;
};

const MOCK_DATA: DashboardData = {
  current_price: { petrol: 64.25, diesel: 71.25, currency: 'MUR', unit: 'L' },
  global_crude: {
    brent_usd: 72.39, wti_usd: 68.15,
    diesel_global_usd: 3.13, gasoline_global_usd: 2.98,
    updated_at: new Date().toISOString(), source: 'OilPriceAPI',
  },
  trend: { petrol: 'down', petrol_change: 0.2, diesel: 'up', diesel_change: 0.5 },
  risk_level: 'Moderate',
  impact_score: 'Medium',
  recommendation: {
    title: 'Fuel Up Now',
    content: 'Prices are projected to rise by 4.2% in the next 24 hours.',
  },
  market_update: 'Global crude supply fluctuations are driving local price hikes.',
  business_type: 'restaurant',
  user_name: 'User',
};

const RISK_COLORS: Record<string, string> = {
  Low: '#2e7d32', Moderate: '#f57c00', High: '#d32f2f',
};

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-MU', { month: 'short', day: 'numeric', year: 'numeric' });
}

function makeSparklineSmooth(current: number, trend: string, change: number, points: number = 14): number[] {
  const arr: number[] = [];
  for (let i = points; i >= 0; i--) {
    const pct = i / points;
    const trendVal = trend === 'up' ? change / 100 : -change / 100;
    const noise = (Math.random() - 0.5) * 0.008;
    arr.push(parseFloat((current - current * trendVal * pct * pct + noise).toFixed(3)));
  }
  return arr;
}

function calcRiskPercent(risk: string, trend: string): number {
  const base = risk === 'Low' ? 15 : risk === 'Moderate' ? 45 : 75;
  const trendBoost = trend === 'up' ? 12 : trend === 'down' ? -8 : 0;
  return Math.min(100, Math.max(0, base + trendBoost));
}

function calcImpactPercent(impact: string, change: number): number {
  const base = impact === 'Low' ? 10 : impact === 'Medium' ? 35 : 65;
  const changeBoost = change * 2;
  return Math.min(100, Math.max(0, base + changeBoost));
}

export default function HomeScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<OilNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<OilNews | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const [fuelLiters, setFuelLiters] = useState('45');
  const [lastRefill, setLastRefill] = useState<Date | null>(null);
  const [kmDriven, setKmDriven] = useState('0');
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillAmount, setRefillAmount] = useState('');

  const riskPct = data ? calcRiskPercent(data.risk_level, data.trend.petrol) : 0;
  const impactPct = data ? calcImpactPercent(data.impact_score, data.trend.petrol_change) : 0;
  const dailyEstKm = data?.business_type === 'taxi' ? 120 : data?.business_type === 'delivery' ? 80 : data?.business_type === 'logistics' ? 150 : 30;
  const weeklyFuelCost = data ? parseFloat(fuelLiters || '0') * data.current_price.petrol * 7 : 0;

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const res = await api.dashboard.get();
      setData(res);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err.detail || 'Unable to load dashboard');
      if (!data) setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [data]);

  const fetchNews = useCallback(async () => {
    try {
      const articles = await api.news.list();
      setNews(articles);
    } catch {
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api.dashboard.get();
      setData(res);
    } catch (err: any) {
      if (err.status !== 401) setError(err.detail || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  const user = getUser();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>AstraFlow</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🇲🇺 Mauritius</Text>
          </View>
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
        {loading && !data ? (
          <View style={styles.scrollContent}>
            <View style={[styles.bannerCard, { gap: 6 }]}>
              <View style={{ width: 80, height: 10, backgroundColor: '#e2e2e5', borderRadius: 4 }} />
              <View style={{ width: '60%', height: 18, backgroundColor: '#e2e2e5', borderRadius: 4 }} />
            </View>
            <View style={styles.priceGrid}>
              <View style={styles.priceCard}><View style={{ height: 14, width: '50%', backgroundColor: '#e2e2e5', borderRadius: 4 }} /><View style={{ height: 22, width: '70%', backgroundColor: '#e2e2e5', borderRadius: 4, marginTop: 6 }} /></View>
              <View style={styles.priceCard}><View style={{ height: 14, width: '50%', backgroundColor: '#e2e2e5', borderRadius: 4 }} /><View style={{ height: 22, width: '70%', backgroundColor: '#e2e2e5', borderRadius: 4, marginTop: 6 }} /></View>
            </View>
          </View>
        ) : data ? (
          <>
            {error && (
              <TouchableOpacity style={styles.errorBanner} onPress={fetchDashboard}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            <View style={styles.bannerCard}>
              <View style={styles.bannerAccent} />
              <View style={styles.bannerContent}>
                <Text style={styles.bannerLabel}>Recommendation</Text>
                <Text style={styles.bannerTitle}>{data.recommendation.title}</Text>
                <Text style={styles.bannerText}>{data.recommendation.content}</Text>
              </View>
            </View>

            <View style={styles.priceGrid}>
              <View style={[styles.priceCard, { borderTopColor: '#003087', borderTopWidth: 3 }]}>
                <View style={styles.priceHeader}>
                  <Text style={styles.priceLabel}>Petrol</Text>
                  <View style={styles.trendRow}>
                    <Text style={data.trend.petrol === 'up' ? styles.trendUp : styles.trendDown}>
                      {data.trend.petrol === 'up' ? '↑' : '↓'}
                    </Text>
                    <Text style={data.trend.petrol === 'up' ? styles.trendUpText : styles.trendDownText}>
                      {data.trend.petrol_change}%
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <View>
                    <Text style={styles.priceValue}>
                      Rs {data.current_price.petrol.toFixed(2)}
                      <Text style={styles.priceUnit}>/{data.current_price.unit}</Text>
                    </Text>
                    <Text style={styles.priceSub}>per litre</Text>
                  </View>
                  <Sparkline
                    data={makeSparklineSmooth(data.current_price.petrol, data.trend.petrol, data.trend.petrol_change)}
                    width={90}
                    height={36}
                    color="#003087"
                    strokeWidth={2}
                  />
                </View>
              </View>

              <View style={[styles.priceCard, { borderTopColor: '#d32f2f', borderTopWidth: 3 }]}>
                <View style={styles.priceHeader}>
                  <Text style={styles.priceLabel}>Diesel</Text>
                  <View style={styles.trendRow}>
                    <Text style={data.trend.diesel === 'up' ? styles.trendUp : styles.trendDown}>
                      {data.trend.diesel === 'up' ? '↑' : '↓'}
                    </Text>
                    <Text style={data.trend.diesel === 'up' ? styles.trendUpText : styles.trendDownText}>
                      {data.trend.diesel_change}%
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <View>
                    <Text style={styles.priceValue}>
                      Rs {data.current_price.diesel.toFixed(2)}
                      <Text style={styles.priceUnit}>/{data.current_price.unit}</Text>
                    </Text>
                    <Text style={styles.priceSub}>per litre</Text>
                  </View>
                  <Sparkline
                    data={makeSparklineSmooth(data.current_price.diesel, data.trend.diesel, data.trend.diesel_change)}
                    width={90}
                    height={36}
                    color="#d32f2f"
                    strokeWidth={2}
                  />
                </View>
              </View>
            </View>

            <View style={styles.fuelUsageCard}>
              <View style={styles.fuelUsageHeader}>
                <Text style={styles.fuelUsageTitle}>Your Fuel Usage</Text>
                <TouchableOpacity style={styles.refillBtn} onPress={() => setShowRefillModal(true)}>
                  <Text style={styles.refillBtnText}>+ Refill</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fuelUsageGrid}>
                <View style={styles.fuelUsageItem}>
                  <Text style={styles.fuelUsageLabel}>Daily usage</Text>
                  <Text style={styles.fuelUsageValue}>{fuelLiters} L</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={styles.fuelUsageLabel}>Est. driven</Text>
                  <Text style={styles.fuelUsageValue}>{kmDriven || dailyEstKm} km/day</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={styles.fuelUsageLabel}>Weekly cost</Text>
                  <Text style={styles.fuelUsageValue}>Rs {weeklyFuelCost.toFixed(0)}</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={styles.fuelUsageLabel}>Last refill</Text>
                  <Text style={styles.fuelUsageValue}>{lastRefill ? formatDate(lastRefill) : '—'}</Text>
                </View>
              </View>
              <View style={styles.fuelUsageRow}>
                <Text style={styles.fuelUsageHint}>Daily consumption</Text>
                <View style={styles.fuelInputRow}>
                  <TextInput
                    style={styles.fuelInput}
                    value={fuelLiters}
                    onChangeText={setFuelLiters}
                    keyboardType="numeric"
                    placeholder="45"
                  />
                  <Text style={styles.fuelInputUnit}>L</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightCard}>
              <View style={styles.insightIconContainer}>
                <Text style={styles.insightIcon}>💡</Text>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Market Update</Text>
                <Text style={styles.insightText}>{data.market_update}</Text>
              </View>
            </View>

            {data.global_crude?.brent_usd && (
              <View style={styles.globalCrudeCard}>
                <Text style={styles.globalCrudeTitle}>🌍 Global Crude Benchmark</Text>
                <View style={styles.globalCrudeRow}>
                  <View style={styles.globalCrudeItem}>
                    <Text style={styles.globalCrudeLabel}>Brent</Text>
                    <Text style={styles.globalCrudeValue}>${data.global_crude.brent_usd.toFixed(2)}</Text>
                    <Text style={styles.globalCrudeUnit}>/bbl</Text>
                  </View>
                  <View style={styles.globalCrudeDivider} />
                  <View style={styles.globalCrudeItem}>
                    <Text style={styles.globalCrudeLabel}>WTI</Text>
                    <Text style={styles.globalCrudeValue}>${data.global_crude.wti_usd?.toFixed(2)}</Text>
                    <Text style={styles.globalCrudeUnit}>/bbl</Text>
                  </View>
                  <View style={styles.globalCrudeDivider} />
                  <View style={styles.globalCrudeItem}>
                    <Text style={styles.globalCrudeLabel}>Gasoline</Text>
                    <Text style={styles.globalCrudeValue}>${data.global_crude.gasoline_global_usd?.toFixed(2)}</Text>
                    <Text style={styles.globalCrudeUnit}>/gal</Text>
                  </View>
                </View>
                <View style={styles.mauritiusImpact}>
                  <Text style={styles.impactTitle}>Impact on Mauritius</Text>
                  <Text style={styles.impactText}>
                    Brent crude at ${data.global_crude.brent_usd.toFixed(2)}/bbl {data.trend.petrol === 'up' ? 'pushes' : 'eases'} local retail prices.
                    Mauritius imports refined petroleum — every ${data.trend.petrol === 'up' ? 'rise' : 'drop'} in crude reflects at the pump within 2-3 weeks.
                  </Text>
                </View>
                <Text style={styles.globalCrudeSource}>via {data.global_crude.source}</Text>
              </View>
            )}

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Fuel Risk</Text>
                <View style={styles.metricBarTrack}>
                  <View style={[styles.metricBarFill, { width: `${riskPct}%`, backgroundColor: RISK_COLORS[data.risk_level] || '#f57c00' }]} />
                </View>
                <Text style={[styles.metricValue, { color: RISK_COLORS[data.risk_level] || '#f57c00' }]}>
                  {data.risk_level} · {riskPct.toFixed(0)}%
                </Text>
                <Text style={styles.metricSub}>Based on trend & your usage</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Business Impact</Text>
                <View style={styles.metricBarTrack}>
                  <View style={[styles.metricBarFill, { width: `${impactPct}%`, backgroundColor: RISK_COLORS[impactPct > 50 ? 'High' : impactPct > 25 ? 'Moderate' : 'Low'] || '#f57c00' }]} />
                </View>
                <Text style={[styles.metricValue, { color: RISK_COLORS[impactPct > 50 ? 'High' : impactPct > 25 ? 'Moderate' : 'Low'] || '#f57c00' }]}>
                  {data.impact_score} · {impactPct.toFixed(0)}%
                </Text>
                <Text style={styles.metricSub}>Weekly Rs {weeklyFuelCost.toFixed(0)} spend</Text>
              </View>
            </View>

            <View style={styles.newsSection}>
              <Text style={styles.newsSectionTitle}>Oil & Fuel Market — Mauritius</Text>
              {newsLoading ? (
                <View style={{ gap: 12 }}>
                  <View style={{ height: 60, backgroundColor: '#e2e2e5', borderRadius: 8 }} />
                  <View style={{ height: 60, backgroundColor: '#e2e2e5', borderRadius: 8 }} />
                </View>
              ) : news.length === 0 ? (
                <Text style={styles.newsEmpty}>No news articles available</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {news.map(article => (
                    <TouchableOpacity
                      key={article.id}
                      style={styles.newsCard}
                      onPress={() => setSelectedNews(article)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.newsTitle}>{article.title}</Text>
                      <Text style={styles.newsSummary} numberOfLines={2}>{article.summary}</Text>
                      <View style={styles.newsMeta}>
                        <Text style={styles.newsSource}>{article.source}</Text>
                        <Text style={styles.newsDate}>{article.published_at}</Text>
                      </View>
                      <Text style={styles.newsRead}>Read →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showRefillModal} transparent animationType="slide" onRequestClose={() => setShowRefillModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Refill</Text>
              <TouchableOpacity onPress={() => setShowRefillModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.refillLabel}>Liters refilled</Text>
              <TextInput
                style={styles.refillInput}
                value={refillAmount}
                onChangeText={setRefillAmount}
                keyboardType="numeric"
                placeholder="e.g. 45"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.refillSubmit, !refillAmount && { opacity: 0.5 }]}
                disabled={!refillAmount}
                onPress={() => {
                  setFuelLiters(refillAmount);
                  setLastRefill(new Date());
                  setShowRefillModal(false);
                  setRefillAmount('');
                }}
              >
                <Text style={styles.refillSubmitText}>Log Refill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedNews !== null} transparent animationType="slide" onRequestClose={() => setSelectedNews(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalSource}>{selectedNews?.source}</Text>
              <TouchableOpacity onPress={() => setSelectedNews(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.newsDetailTitle}>{selectedNews?.title}</Text>
              <Text style={styles.newsDetailDate}>{selectedNews?.published_at}</Text>
              <View style={styles.modalDivider} />
              <Text style={styles.newsDetailContent}>{selectedNews?.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#003087' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 22 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  errorBanner: {
    backgroundColor: '#ffdad6', padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, color: '#93000a', flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', color: '#ba1a1a', marginLeft: 8 },

  bannerCard: {
    backgroundColor: '#e8edf5', borderRadius: 10, flexDirection: 'row',
    overflow: 'hidden', borderWidth: 1, borderColor: '#cdd7e6',
  },
  bannerAccent: { width: 5, backgroundColor: '#003087' },
  bannerContent: { flex: 1, padding: 14, gap: 4 },
  bannerLabel: { fontSize: 10, fontWeight: '700', color: '#003087', textTransform: 'uppercase', letterSpacing: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#1a1c1e' },
  bannerText: { fontSize: 13, color: '#444652', lineHeight: 18 },

  priceGrid: { flexDirection: 'row', gap: 10 },
  priceCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 1, borderColor: '#dee5ef', padding: 14, gap: 6,
  },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 12, fontWeight: '600', color: '#747683' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendDown: { color: '#2e7d32', fontSize: 13 },
  trendDownText: { fontSize: 12, color: '#2e7d32', fontWeight: '600' },
  trendUp: { color: '#d32f2f', fontSize: 13 },
  trendUpText: { fontSize: 12, color: '#d32f2f', fontWeight: '600' },
  priceValue: { fontSize: 20, fontWeight: '700', color: '#1a1c1e' },
  priceUnit: { fontSize: 11, fontWeight: '400', color: '#747683' },
  priceSub: { fontSize: 10, color: '#747683', marginTop: -2 },

  fuelUsageCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, gap: 12,
  },
  fuelUsageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelUsageTitle: { fontSize: 14, fontWeight: '700', color: '#1a1c1e' },
  refillBtn: { backgroundColor: '#003087', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  refillBtnText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  fuelUsageGrid: { flexDirection: 'row', gap: 8 },
  fuelUsageItem: { flex: 1, alignItems: 'center', gap: 2 },
  fuelUsageLabel: { fontSize: 9, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  fuelUsageValue: { fontSize: 14, fontWeight: '700', color: '#1a1c1e' },
  fuelUsageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelUsageHint: { fontSize: 12, color: '#747683' },
  fuelInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fuelInput: {
    width: 60, height: 32, borderWidth: 1, borderColor: '#c4c6d4', borderRadius: 6,
    paddingHorizontal: 8, fontSize: 14, color: '#1a1c1e', textAlign: 'center',
  },
  fuelInputUnit: { fontSize: 12, color: '#747683' },

  insightCard: {
    backgroundColor: '#f0f4fa', borderRadius: 8, padding: 14,
    flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: 'rgba(196,198,212,0.3)',
  },
  insightIconContainer: { width: 36, height: 36, backgroundColor: '#003087', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  insightIcon: { fontSize: 18 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 13, fontWeight: '600', color: '#1a1c1e' },
  insightText: { fontSize: 13, color: '#444652', lineHeight: 18 },

  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 1, borderColor: '#dee5ef', padding: 14, gap: 6,
  },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  metricBarTrack: { height: 6, backgroundColor: '#e2e2e5', borderRadius: 3, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 3 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricSub: { fontSize: 10, color: '#747683' },

  badge: {
    backgroundColor: '#dbe1ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#003087' },

  newsSection: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 16, gap: 12,
  },
  newsSectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#1a1c1e', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  newsEmpty: { fontSize: 14, color: '#747683', textAlign: 'center', paddingVertical: 16 },
  newsCard: {
    backgroundColor: '#f9f9fc', borderRadius: 8, borderWidth: 1, borderColor: '#f0f0f3',
    padding: 12, gap: 4,
  },
  newsTitle: { fontSize: 14, fontWeight: '700', color: '#1a1c1e', lineHeight: 18 },
  newsSummary: { fontSize: 13, color: '#444652', lineHeight: 17 },
  newsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  newsSource: { fontSize: 11, fontWeight: '600', color: '#003087' },
  newsDate: { fontSize: 11, color: '#747683' },
  newsRead: { fontSize: 13, fontWeight: '600', color: '#003087', marginTop: 4 },

  globalCrudeCard: {
    backgroundColor: '#0a1929', borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#1a3a5c',
  },
  globalCrudeTitle: { fontSize: 13, fontWeight: '700', color: '#80bfff', textTransform: 'uppercase', letterSpacing: 0.5 },
  globalCrudeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  globalCrudeItem: { alignItems: 'center', gap: 2 },
  globalCrudeLabel: { fontSize: 11, fontWeight: '600', color: '#a0c4ff' },
  globalCrudeValue: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  globalCrudeUnit: { fontSize: 11, color: '#80bfff' },
  globalCrudeDivider: { width: 1, height: 36, backgroundColor: '#1a3a5c' },
  globalCrudeSource: { fontSize: 10, color: '#5a7a9a', textAlign: 'center' },
  mauritiusImpact: {
    backgroundColor: 'rgba(0,48,135,0.15)', borderRadius: 8, padding: 12, gap: 4,
  },
  impactTitle: { fontSize: 11, fontWeight: '700', color: '#80bfff', textTransform: 'uppercase' },
  impactText: { fontSize: 12, color: '#b0d0ff', lineHeight: 17 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f3f6',
  },
  modalSource: { fontSize: 13, fontWeight: '600', color: '#003087' },
  modalClose: { fontSize: 20, color: '#747683', padding: 4 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  modalDivider: { height: 1, backgroundColor: '#f3f3f6', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1e' },
  refillLabel: { fontSize: 14, fontWeight: '600', color: '#444652' },
  refillInput: {
    height: 48, borderWidth: 1, borderColor: '#c4c6d4', borderRadius: 8,
    paddingHorizontal: 16, fontSize: 16, backgroundColor: '#f9f9fc', color: '#1a1c1e',
  },
  refillSubmit: {
    height: 48, backgroundColor: '#003087', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  refillSubmitText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  newsDetailTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1e', lineHeight: 26, marginBottom: 8 },
  newsDetailDate: { fontSize: 12, color: '#747683', marginBottom: 12 },
  newsDetailContent: { fontSize: 15, color: '#1a1c1e', lineHeight: 24 },
});
