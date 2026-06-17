import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api, ApiError } from '@/services/api';
import { getUser } from '@/services/auth';
import { Sparkline } from '@/components/Sparkline';

type DashboardData = {
  current_price: { petrol: number; diesel: number; currency: string; unit: string };
  trend: { petrol: string; petrol_change: number; diesel: string; diesel_change: number };
  risk_level: string;
  impact_score: string;
  recommendation: { title: string; content: string };
  market_update: string;
  business_type: string;
  user_name: string;
};

const MOCK_DATA: DashboardData = {
  current_price: { petrol: 1.64, diesel: 1.78, currency: 'USD', unit: 'L' },
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
                    ${data!.current_price.petrol.toFixed(2)}
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
                    ${data!.current_price.diesel.toFixed(2)}
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

              <TouchableOpacity style={styles.surveyCard} onPress={() => router.push('/survey')}>
                <View style={styles.surveyIconRow}>
                  <Text style={styles.surveyIcon}>📋</Text>
                  <Text style={styles.surveyBadge}>2 min</Text>
                </View>
                <Text style={styles.surveyTitle}>Fuel Impact Survey</Text>
                <Text style={styles.surveyText}>
                  Tell us how fuel prices affect your business — help us personalize insights for you.
                </Text>
                <Text style={styles.surveyCTA}>Take Survey →</Text>
              </TouchableOpacity>
            </>
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
  surveyCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#003087',
    padding: 20, gap: 8, borderLeftWidth: 4,
  },
  surveyIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surveyIcon: { fontSize: 20 },
  surveyBadge: {
    fontSize: 10, fontWeight: '600', color: '#003087', backgroundColor: '#dbe1ff',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase',
  },
  surveyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1e' },
  surveyText: { fontSize: 14, color: '#444652', lineHeight: 20 },
  surveyCTA: { fontSize: 14, fontWeight: '600', color: '#003087', marginTop: 4 },
});
