import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Animated, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api, ApiError } from '@/services/api';
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
const IMPACT_COLORS: Record<string, string> = {
  Low: '#2e7d32', Medium: '#f57c00', High: '#d32f2f',
};

function makeSparkline(current: number, trend: string, change: number): number[] {
  const arr: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const pct = i / 6;
    const trendVal = trend === 'up' ? change / 100 : -change / 100;
    arr.push(parseFloat((current - current * trendVal * pct + (Math.random() - 0.5) * 0.01).toFixed(3)));
  }
  return arr;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  MUR: 'Rs', USD: '$', EUR: '€', GBP: '£',
};

function currencySymbol(code: string | undefined): string {
  return CURRENCY_SYMBOLS[code ?? ''] || code || '$';
}

function SkeletonBlock({ width, height, style }: { width?: number | string; height: number; style?: any }) {
  return (
    <View style={[{ width: width ?? '100%', height, backgroundColor: '#e2e2e5', borderRadius: 8 }, style]} />
  );
}

function SkeletonDashboard() {
  return (
    <View style={styles.scrollContent}>
      <View style={[styles.heroCard, { gap: 8 }]}>
        <SkeletonBlock width={100} height={12} />
        <SkeletonBlock width="70%" height={28} />
        <SkeletonBlock width="85%" height={14} />
      </View>
      <View style={styles.priceGrid}>
        <View style={styles.priceCard}><SkeletonBlock height={16} /><SkeletonBlock width="60%" height={24} /></View>
        <View style={styles.priceCard}><SkeletonBlock height={16} /><SkeletonBlock width="60%" height={24} /></View>
      </View>
      <View style={styles.insightCard}><SkeletonBlock height={40} width={40} style={{ borderRadius: 8 }} /><View style={{ flex: 1, gap: 4 }}><SkeletonBlock width="40%" height={14} /><SkeletonBlock height={12} /></View></View>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}><SkeletonBlock width="60%" height={14} /><SkeletonBlock width="40%" height={24} /></View>
        <View style={styles.metricCard}><SkeletonBlock width="60%" height={14} /><SkeletonBlock width="40%" height={24} /></View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<OilNews[]>([]);
  const [selectedNews, setSelectedNews] = useState<OilNews | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

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

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

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

  useEffect(() => {
    fetchDashboard();
  }, []);

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
          <SkeletonDashboard />
        ) : (
          <>
            {error && (
              <TouchableOpacity style={styles.errorBanner} onPress={fetchDashboard}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            <View style={styles.heroCard}>
              <View style={styles.heroBg} />
              <Text style={styles.heroLabel}>Recommendation</Text>
              <Text style={styles.heroTitle}>{data!.recommendation.title}</Text>
              <Text style={styles.heroText}>{data!.recommendation.content}</Text>
            </View>

            <View style={styles.priceGrid}>
              <View style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <Text style={styles.priceLabel}>Petrol</Text>
                  <View style={styles.trendRow}>
                    <Text style={data!.trend.petrol === 'up' ? styles.trendUp : styles.trendDown}>
                      {data!.trend.petrol === 'up' ? '↑' : '↓'}
                    </Text>
                    <Text style={data!.trend.petrol === 'up' ? styles.trendUpText : styles.trendDownText}>
                      {data!.trend.petrol_change}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <Text style={styles.priceValue}>
                    {currencySymbol(data!.current_price.currency)} {data!.current_price.petrol.toFixed(2)}
                    <Text style={styles.priceUnit}>/{data!.current_price.unit}</Text>
                  </Text>
                  <Sparkline
                    data={makeSparkline(data!.current_price.petrol, data!.trend.petrol, data!.trend.petrol_change)}
                    color="#003087"
                  />
                </View>
                <View style={styles.badgeLow}>
                  <Text style={styles.badgeLowText}>Lowest 7-day</Text>
                </View>
              </View>

              <View style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <Text style={styles.priceLabel}>Diesel</Text>
                  <View style={styles.trendRow}>
                    <Text style={data!.trend.diesel === 'up' ? styles.trendUp : styles.trendDown}>
                      {data!.trend.diesel === 'up' ? '↑' : '↓'}
                    </Text>
                    <Text style={data!.trend.diesel === 'up' ? styles.trendUpText : styles.trendDownText}>
                      {data!.trend.diesel_change}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <Text style={styles.priceValue}>
                    {currencySymbol(data!.current_price.currency)} {data!.current_price.diesel.toFixed(2)}
                    <Text style={styles.priceUnit}>/{data!.current_price.unit}</Text>
                  </Text>
                  <Sparkline
                    data={makeSparkline(data!.current_price.diesel, data!.trend.diesel, data!.trend.diesel_change)}
                    color="#d32f2f"
                  />
                </View>
                <View style={styles.badgeRising}>
                  <Text style={styles.badgeRisingText}>Rising</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightCard}>
              <View style={styles.insightIconContainer}>
                <Text style={styles.insightIcon}>💡</Text>
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Market Update</Text>
                <Text style={styles.insightText}>{data!.market_update}</Text>
              </View>
            </View>

              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Fuel Risk</Text>
                  <Text style={[styles.metricValue, { color: RISK_COLORS[data!.risk_level] || '#f57c00' }]}>
                    {data!.risk_level}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Business Impact</Text>
                  <Text style={[styles.metricValue, { color: IMPACT_COLORS[data!.impact_score] || '#f57c00' }]}>
                    {data!.impact_score}
                  </Text>
                </View>
              </View>

              {data!.global_crude?.brent_usd && (
                <View style={styles.globalCrudeCard}>
                  <Text style={styles.globalCrudeTitle}>🌍 Global Crude Benchmark</Text>
                  <View style={styles.globalCrudeRow}>
                    <View style={styles.globalCrudeItem}>
                      <Text style={styles.globalCrudeLabel}>Brent</Text>
                      <Text style={styles.globalCrudeValue}>${data!.global_crude.brent_usd.toFixed(2)}</Text>
                      <Text style={styles.globalCrudeUnit}>/bbl</Text>
                    </View>
                    <View style={styles.globalCrudeDivider} />
                    <View style={styles.globalCrudeItem}>
                      <Text style={styles.globalCrudeLabel}>WTI</Text>
                      <Text style={styles.globalCrudeValue}>${data!.global_crude.wti_usd?.toFixed(2)}</Text>
                      <Text style={styles.globalCrudeUnit}>/bbl</Text>
                    </View>
                  </View>
                  <Text style={styles.globalCrudeSource}>via {data!.global_crude.source}</Text>
                </View>
              )}

              <View style={styles.newsSection}>
                <Text style={styles.newsSectionTitle}>Oil & Fuel Market — Mauritius</Text>
                {newsLoading ? (
                  <View style={{ gap: 12 }}>
                    <SkeletonBlock height={60} />
                    <SkeletonBlock height={60} />
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
          )}
        </ScrollView>

        <Modal
          visible={selectedNews !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedNews(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSource}>{selectedNews?.source}</Text>
                <TouchableOpacity onPress={() => setSelectedNews(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalTitle}>{selectedNews?.title}</Text>
                <Text style={styles.modalDate}>{selectedNews?.published_at}</Text>
                <View style={styles.modalDivider} />
                <Text style={styles.modalContent}>{selectedNews?.content}</Text>
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
  headerIcon: { fontSize: 22 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#003087' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  profileIcon: { fontSize: 22 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 24 },
  errorBanner: {
    backgroundColor: '#ffdad6', padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, color: '#93000a', flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', color: '#ba1a1a', marginLeft: 8 },
  heroCard: {
    backgroundColor: '#f0f4fa', borderRadius: 12, padding: 24,
    position: 'relative', overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute', right: -32, top: -32, width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(0,48,135,0.05)',
  },
  heroLabel: { fontSize: 12, fontWeight: '600', color: '#1c4197', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#003087', lineHeight: 32, marginBottom: 8 },
  heroText: { fontSize: 14, color: '#444652', lineHeight: 20, maxWidth: '85%' },
  priceGrid: { flexDirection: 'row', gap: 12 },
  priceCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: 1, borderColor: '#dee5ef', padding: 16, gap: 8,
  },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 12, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendDown: { color: '#2e7d32', fontSize: 14 },
  trendDownText: { fontSize: 12, color: '#2e7d32' },
  trendUp: { color: '#d32f2f', fontSize: 14 },
  trendUpText: { fontSize: 12, color: '#d32f2f' },
  priceValue: { fontSize: 24, fontWeight: '700', color: '#1a1c1e' },
  priceUnit: { fontSize: 12, fontWeight: '400', color: '#747683' },
  badgeLow: { alignSelf: 'flex-start', backgroundColor: 'rgba(219,225,255,0.3)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeLowText: { fontSize: 10, fontWeight: '600', color: '#003087', textTransform: 'uppercase' },
  badgeRising: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,218,214,0.4)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeRisingText: { fontSize: 10, fontWeight: '600', color: '#d32f2f', textTransform: 'uppercase' },
  insightCard: {
    backgroundColor: '#f3f3f6', borderRadius: 8, padding: 16,
    flexDirection: 'row', gap: 16, borderWidth: 1, borderColor: 'rgba(196,198,212,0.3)',
  },
  insightIconContainer: { width: 40, height: 40, backgroundColor: '#003087', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  insightIcon: { fontSize: 20 },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 14, fontWeight: '600', color: '#1a1c1e' },
  insightText: { fontSize: 14, color: '#444652', lineHeight: 20 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: 1, borderColor: '#dee5ef', padding: 16, alignItems: 'center', gap: 4,
  },
  metricLabel: { fontSize: 12, fontWeight: '600', color: '#747683', textTransform: 'uppercase' },
  metricValue: { fontSize: 20, fontWeight: '700' },

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
  globalCrudeLabel: { fontSize: 12, fontWeight: '600', color: '#a0c4ff' },
  globalCrudeValue: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  globalCrudeUnit: { fontSize: 12, color: '#80bfff' },
  globalCrudeDivider: { width: 1, height: 40, backgroundColor: '#1a3a5c' },
  globalCrudeSource: { fontSize: 10, color: '#5a7a9a', textAlign: 'center' },
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
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1e', lineHeight: 26, marginBottom: 8 },
  modalDate: { fontSize: 12, color: '#747683', marginBottom: 12 },
  modalDivider: { height: 1, backgroundColor: '#f3f3f6', marginBottom: 16 },
  modalContent: { fontSize: 15, color: '#1a1c1e', lineHeight: 24 },
});
