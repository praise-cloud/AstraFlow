import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/services/api';
import { getUser } from '@/services/auth';
import { Sparkline } from '@/components/Sparkline';
import { useAppColor } from '@/hooks/useAppColor';
import { getCurrentLanguage } from '@/i18n';
import { AnimatedPressable } from '@/components/animations/AnimatedPressable';
import { AnimatedBar } from '@/components/animations/AnimatedBar';
import { StaggerContainer } from '@/components/animations/StaggerContainer';
import { SlideInView } from '@/components/animations/SlideInView';
import { Shimmer } from '@/components/animations/Shimmer';
import { ColorPopView } from '@/components/animations/ColorPopView';
import { GlowEffect } from '@/components/animations/GlowEffect';

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
  fuel_type: string;
  avatar_url: string | null;
  user_name: string;
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
  fuel_type: 'petrol',
  avatar_url: null,
  user_name: 'User',
};

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const lang = getCurrentLanguage();
  return date.toLocaleDateString(lang === 'fr' ? 'fr-MU' : 'en-MU', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const colors = useAppColor();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fuelLiters, setFuelLiters] = useState('45');
  const [lastRefill, setLastRefill] = useState<Date | null>(null);
  const [kmDriven, setKmDriven] = useState('0');

  const user = getUser();
  const userFuelType = data?.fuel_type || user?.fuel_type || 'petrol';
  const showPetrol = userFuelType === 'petrol' || userFuelType === 'both';
  const showDiesel = userFuelType === 'diesel' || userFuelType === 'both';

  const riskPct = data ? calcRiskPercent(data.risk_level, data.trend.petrol) : 0;
  const impactPct = data ? calcImpactPercent(data.impact_score, data.trend.petrol_change) : 0;
  const dailyEstKm = data?.business_type === 'taxi' ? 120 : data?.business_type === 'delivery' ? 80 : data?.business_type === 'logistics' ? 150 : 30;
  const relevantPrice = showPetrol ? data?.current_price.petrol : data?.current_price.diesel;
  const weeklyFuelCost = data && relevantPrice ? parseFloat(fuelLiters || '0') * relevantPrice * 7 : 0;

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
      setError(err.detail || t('home.errorDashboard'));
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
      if (err.status !== 401) setError(err.detail || t('home.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="gas-station-outline" size={22} color={colors.accentPetrol} />
          <Text style={[styles.headerTitle, { color: colors.accentPetrol }]}>{t('home.header')}</Text>
          <View style={[styles.badge, { backgroundColor: colors.badgeBg }]}>
            <Ionicons name="flag-outline" size={14} color={colors.badgeText} />
            <Text style={[styles.badgeText, { color: colors.badgeText }]}> {t('home.location')}</Text>
          </View>
        </View>
        <AnimatedPressable style={styles.profileBtn} onPress={() => router.push('/profile')} scaleTo={0.9}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accentPetrol }]}>
              <Text style={[styles.avatarLetter, { color: colors.textWhite }]}>
                {(user?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPetrol} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading && !data ? (
          <View style={styles.scrollContent}>
            <SlideInView direction="up" duration={300}>
              <View style={[styles.bannerCard, { backgroundColor: colors.bgBanner, borderColor: colors.borderLight }]}>
                <Shimmer width={80} height={10} borderRadius={4} baseColor={colors.bgSkeleton} shimmerColor="rgba(255,255,255,0.1)" />
                <Shimmer width="60%" height={18} borderRadius={4} baseColor={colors.bgSkeleton} shimmerColor="rgba(255,255,255,0.1)" delay={100} />
              </View>
            </SlideInView>
            <SlideInView direction="up" duration={300} delay={100}>
              <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flex: 1 }]}>
                <Shimmer width="50%" height={14} borderRadius={4} baseColor={colors.bgSkeleton} shimmerColor="rgba(255,255,255,0.1)" />
                <Shimmer width="70%" height={22} borderRadius={4} baseColor={colors.bgSkeleton} shimmerColor="rgba(255,255,255,0.1)" delay={150} />
              </View>
            </SlideInView>
          </View>
        ) : data ? (
          <>
            {error && (
              <AnimatedPressable
                style={[styles.errorBanner, { backgroundColor: colors.bgError }]}
                onPress={fetchDashboard}
                scaleTo={0.98}
                haptic="light"
                sound="tap"
              >
                <Text style={[styles.errorText, { color: colors.textError }]}>{error}</Text>
                <Text style={[styles.retryText, { color: colors.textError }]}>{t('common.retry')}</Text>
              </AnimatedPressable>
            )}

            <StaggerContainer staggerDelay={100} direction="up" duration={350}>
              <SlideInView direction="up" duration={400}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {showPetrol && (
                    <View style={[styles.bentoPriceCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderTopColor: colors.accentPetrol, borderTopWidth: 3, flex: showDiesel ? 1 : undefined }]}>
                      <View style={styles.bentoPriceTop}>
                        <MaterialCommunityIcons name="gas-station-outline" size={20} color={colors.accentPetrol} />
                        <Text style={[styles.bentoPriceLabel, { color: colors.textMuted }]}>{t('common.petrol')}</Text>
                      </View>
                      <Text style={[styles.bentoPriceValue, { color: colors.textPrimary }]}>
                        Rs {data.current_price.petrol.toFixed(2)}
                        <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                      </Text>
                      <View style={styles.bentoPriceFooter}>
                        <View style={[styles.bentoPriceTrend, { backgroundColor: data.trend.petrol === 'up' ? colors.trendUp + '20' : colors.trendDown + '20' }]}>
                          <Ionicons name={data.trend.petrol === 'up' ? 'arrow-up' : 'arrow-down'} size={12} color={data.trend.petrol === 'up' ? colors.trendUp : colors.trendDown} />
                          <Text style={[{ color: data.trend.petrol === 'up' ? colors.trendUp : colors.trendDown, fontSize: 11, fontWeight: '600' }]}>
                            {data.trend.petrol_change}%
                          </Text>
                        </View>
                        <Sparkline
                          data={makeSparklineSmooth(data.current_price.petrol, data.trend.petrol, data.trend.petrol_change)}
                          width={60}
                          height={28}
                          color={colors.accentPetrol}
                          strokeWidth={2}
                        />
                      </View>
                    </View>
                  )}
                  {showDiesel && (
                    <View style={[styles.bentoPriceCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderTopColor: colors.accentDiesel, borderTopWidth: 3, flex: showPetrol ? 1 : undefined }]}>
                      <View style={styles.bentoPriceTop}>
                        <MaterialCommunityIcons name="engine-outline" size={20} color={colors.accentDiesel} />
                        <Text style={[styles.bentoPriceLabel, { color: colors.textMuted }]}>{t('common.diesel')}</Text>
                      </View>
                      <Text style={[styles.bentoPriceValue, { color: colors.textPrimary }]}>
                        Rs {data.current_price.diesel.toFixed(2)}
                        <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                      </Text>
                      <View style={styles.bentoPriceFooter}>
                        <View style={[styles.bentoPriceTrend, { backgroundColor: data.trend.diesel === 'up' ? colors.trendUp + '20' : colors.trendDown + '20' }]}>
                          <Ionicons name={data.trend.diesel === 'up' ? 'arrow-up' : 'arrow-down'} size={12} color={data.trend.diesel === 'up' ? colors.trendUp : colors.trendDown} />
                          <Text style={[{ color: data.trend.diesel === 'up' ? colors.trendUp : colors.trendDown, fontSize: 11, fontWeight: '600' }]}>
                            {data.trend.diesel_change}%
                          </Text>
                        </View>
                        <Sparkline
                          data={makeSparklineSmooth(data.current_price.diesel, data.trend.diesel, data.trend.diesel_change)}
                          width={60}
                          height={28}
                          color={colors.accentDiesel}
                          strokeWidth={2}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </SlideInView>

              <SlideInView direction="up" duration={400} delay={100}>
                <View style={{ flexDirection: 'row', gap: 14 }}>
                  <ColorPopView variant="primary" position="left" thickness={4} style={styles.bentoRecWrapper}>
                    <View style={[styles.bentoRecCard, { backgroundColor: colors.bgBanner, borderColor: colors.borderLight }]}>
                      <Text style={[styles.bannerLabel, { color: colors.accentPetrol }]}>{t('home.recommendation')}</Text>
                      <Text style={[styles.bentoRecTitle, { color: colors.textPrimary }]} numberOfLines={1}>{data.recommendation.title}</Text>
                      <Text style={[styles.bentoRecText, { color: colors.textSecondary }]} numberOfLines={2}>{data.recommendation.content}</Text>
                    </View>
                  </ColorPopView>
                  <View style={{ flex: 1, gap: 14 }}>
                    <GlowEffect variant={data.risk_level === 'High' ? 'danger' : 'warning'} size={2} duration={3000}>
                      <View style={[styles.bentoMiniCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('home.fuelRisk')}</Text>
                        <AnimatedBar percentage={riskPct} color={(colors as any)[`risk${data.risk_level}`] || colors.riskModerate} trackColor={colors.barTrack} height={5} borderRadius={3} duration={700} />
                        <Text style={[styles.bentoMiniValue, { color: (colors as any)[`risk${data.risk_level}`] || colors.riskModerate }]}>{data.risk_level}</Text>
                      </View>
                    </GlowEffect>
                    <GlowEffect variant={impactPct > 50 ? 'danger' : 'warning'} size={2} duration={3000}>
                      <View style={[styles.bentoMiniCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('home.businessImpact')}</Text>
                        <AnimatedBar percentage={impactPct} color={impactPct > 50 ? colors.riskHigh : impactPct > 25 ? colors.riskModerate : colors.riskLow} trackColor={colors.barTrack} height={5} borderRadius={3} duration={700} />
                        <Text style={[styles.bentoMiniValue, { color: impactPct > 50 ? colors.riskHigh : impactPct > 25 ? colors.riskModerate : colors.riskLow }]}>{data.impact_score}</Text>
                      </View>
                    </GlowEffect>
                  </View>
                </View>
              </SlideInView>

              <SlideInView direction="up" duration={400} delay={200}>
                <View style={[styles.bentoFuelCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.bentoFuelHeader}>
                    <Ionicons name="water-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.fuelUsageTitle, { color: colors.textPrimary }]}>{t('home.yourFuelUsage')}</Text>
                  </View>
                  <View style={styles.bentoFuelGrid}>
                    <View style={styles.bentoFuelItem}>
                      <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.dailyUsage')}</Text>
                      <View style={styles.fuelInputRow}>
                        <TextInput
                          style={[styles.fuelInput, { backgroundColor: colors.bg, borderColor: colors.borderInput, color: colors.textPrimary }]}
                          value={fuelLiters}
                          onChangeText={setFuelLiters}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={[styles.fuelInputUnit, { color: colors.textMuted }]}>L</Text>
                      </View>
                    </View>
                    <View style={styles.bentoFuelItem}>
                      <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.estDriven')}</Text>
                      <Text style={[styles.bentoFuelValue, { color: colors.textPrimary }]}>{kmDriven || dailyEstKm} km</Text>
                    </View>
                    <View style={styles.bentoFuelItem}>
                      <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.weeklyCost')}</Text>
                      <Text style={[styles.bentoFuelValue, { color: colors.riskHigh }]}>Rs {weeklyFuelCost.toFixed(0)}</Text>
                    </View>
                    <View style={styles.bentoFuelItem}>
                      <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.lastRefill')}</Text>
                      <Text style={[styles.bentoFuelValue, { color: colors.textPrimary }]}>{lastRefill ? formatDate(lastRefill) : '\u2014'}</Text>
                    </View>
                  </View>
                </View>
              </SlideInView>

              {data.global_crude?.brent_usd && (
                <SlideInView direction="up" duration={400} delay={300}>
                  <View style={[styles.bentoCrudeCard, { backgroundColor: colors.crudeBg, borderColor: colors.crudeDivider }]}>
                    <View style={styles.bentoCrudeHeader}>
                      <Ionicons name="globe-outline" size={16} color={colors.crudeText} />
                      <Text style={[styles.bentoCrudeTitle, { color: colors.crudeText }]}> {t('home.globalCrude')}</Text>
                    </View>
                    <View style={styles.bentoCrudeRow}>
                      <View style={styles.bentoCrudeItem}>
                        <Text style={[styles.crudeLabel, { color: colors.crudeLabel }]}>Brent</Text>
                        <Text style={[styles.crudeValue, { color: colors.crudeValue }]}>${data.global_crude.brent_usd.toFixed(2)}</Text>
                      </View>
                      <View style={[styles.bentoCrudeDivider, { backgroundColor: colors.crudeDivider }]} />
                      <View style={styles.bentoCrudeItem}>
                        <Text style={[styles.crudeLabel, { color: colors.crudeLabel }]}>WTI</Text>
                        <Text style={[styles.crudeValue, { color: colors.crudeValue }]}>${data.global_crude.wti_usd?.toFixed(2)}</Text>
                      </View>
                      <View style={[styles.bentoCrudeDivider, { backgroundColor: colors.crudeDivider }]} />
                      <View style={styles.bentoCrudeItem}>
                        <Text style={[styles.crudeLabel, { color: colors.crudeLabel }]}>Diesel</Text>
                        <Text style={[styles.crudeValue, { color: colors.crudeValue }]}>${data.global_crude.diesel_global_usd?.toFixed(2)}</Text>
                      </View>
                      <View style={[styles.bentoCrudeDivider, { backgroundColor: colors.crudeDivider }]} />
                      <View style={styles.bentoCrudeItem}>
                        <Text style={[styles.crudeLabel, { color: colors.crudeLabel }]}>Gasoline</Text>
                        <Text style={[styles.crudeValue, { color: colors.crudeValue }]}>${data.global_crude.gasoline_global_usd?.toFixed(2)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.bentoCrudeSource, { color: colors.crudeSource }]}>via {data.global_crude.source}</Text>
                  </View>
                </SlideInView>
              )}
            </StaggerContainer>
          </>
        ) : null}
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
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 28 },
  bannerCard: {
    borderRadius: 10, flexDirection: 'row',
    overflow: 'hidden', borderWidth: 1,
  },
  bannerAccent: { width: 5 },
  bannerContent: { flex: 1, padding: 14, gap: 4 },
  bannerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 13, lineHeight: 18 },
  priceCard: {
    borderRadius: 10,
    borderWidth: 1, padding: 16, gap: 6,
  },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 12, fontWeight: '600' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceValue: { fontSize: 20, fontWeight: '700' },
  priceUnit: { fontSize: 11, fontWeight: '400' },
  priceSub: { fontSize: 10, marginTop: -2 },
  fuelUsageCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, gap: 12,
  },
  fuelUsageTitle: { fontSize: 14, fontWeight: '700' },
  fuelUsageGrid: { flexDirection: 'row', gap: 8 },
  fuelUsageItem: { flex: 1, alignItems: 'center', gap: 2 },
  fuelUsageLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  fuelUsageValue: { fontSize: 14, fontWeight: '700' },
  fuelInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fuelInput: {
    width: 60, height: 42, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, fontSize: 14, textAlign: 'center',
  },
  fuelInputUnit: { fontSize: 12 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1, borderRadius: 10,
    borderWidth: 1, padding: 14, gap: 6,
  },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  metricBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 3 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  metricSub: { fontSize: 10 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  errorBanner: {
    padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  globalCrudeCard: {
    borderRadius: 12, padding: 16, gap: 12,
    borderWidth: 1,
  },
  globalCrudeHeader: { flexDirection: 'row', alignItems: 'center' },
  globalCrudeTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  globalCrudeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  globalCrudeItem: { alignItems: 'center', gap: 2 },
  globalCrudeLabel: { fontSize: 11, fontWeight: '600' },
  globalCrudeValue: { fontSize: 20, fontWeight: '800' },
  globalCrudeDivider: { width: 1, height: 24 },
  globalCrudeSource: { fontSize: 10, textAlign: 'center' },

  // Bento-specific styles
  bentoPriceCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 20, gap: 12,
  },
  bentoPriceTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bentoPriceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bentoPriceValue: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
  bentoPriceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bentoPriceTrend: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  bentoRecWrapper: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  bentoRecCard: {
    borderRadius: 14, borderWidth: 1,
    padding: 16, gap: 6,
  },
  bentoRecTitle: { fontSize: 14, fontWeight: '700' },
  bentoRecText: { fontSize: 12, lineHeight: 17 },
  bentoMiniCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 12, gap: 6,
  },
  bentoMiniValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  bentoFuelCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 18, gap: 14,
  },
  bentoFuelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bentoFuelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  bentoFuelItem: { flex: 1, minWidth: 100, gap: 4 },
  bentoFuelValue: { fontSize: 16, fontWeight: '700' },
  bentoCrudeCard: {
    borderRadius: 16, padding: 18, gap: 12,
    borderWidth: 1,
  },
  bentoCrudeHeader: { flexDirection: 'row', alignItems: 'center' },
  bentoCrudeTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  bentoCrudeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  bentoCrudeItem: { alignItems: 'center', gap: 2, flex: 1 },
  bentoCrudeDivider: { width: 1, height: 28 },
  bentoCrudeSource: { fontSize: 10, textAlign: 'center' },
  crudeLabel: { fontSize: 11, fontWeight: '600' },
  crudeValue: { fontSize: 20, fontWeight: '800' },
});
