import { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/services/api';
import { getUser } from '@/services/auth';
import { useAppColor } from '@/hooks/useAppColor';
import { getCurrentLanguage } from '@/i18n';
import { AnimatedPressable } from '@/components/animations/AnimatedPressable';
import { StaggerContainer } from '@/components/animations/StaggerContainer';
import { SlideInView } from '@/components/animations/SlideInView';
import { Shimmer } from '@/components/animations/Shimmer';

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

  const dataLoaded = useRef(false);

  const user = getUser();
  const userFuelType = user?.fuel_type || data?.fuel_type || 'petrol';
  const showPetrol = userFuelType === 'petrol' || userFuelType === 'both';
  const showDiesel = userFuelType === 'diesel' || userFuelType === 'both';

  const dailyEstKm = data?.business_type === 'taxi' ? 120 : data?.business_type === 'delivery' ? 80 : data?.business_type === 'logistics' ? 150 : 30;
  const relevantPrice = showPetrol ? data?.current_price.petrol : data?.current_price.diesel;
  const weeklyFuelCost = data && relevantPrice ? parseFloat(fuelLiters || '0') * relevantPrice * 7 : 0;

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const res = await api.dashboard.get();
      setData(res);
      dataLoaded.current = true;
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err.detail || t('home.errorDashboard'));
      if (!dataLoaded.current) setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

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

            <StaggerContainer staggerDelay={80} direction="up" duration={350} style={{ gap: 24 }}>
              {/* Row 1: Recommendation (full width, primary blue) */}
              <SlideInView direction="up" duration={400}>
                <View style={[styles.recFullCard, { backgroundColor: colors.bgPrimary }]}>
                  <View style={styles.recFullGlow}>
                    <Ionicons name="notifications-active" size={100} color={colors.accentPetrol} style={{ opacity: 0.2 }} />
                  </View>
                  <Text style={[styles.recFullLabel, { color: colors.textWhite }]}>{t('home.recommendation')}</Text>
                  <Text style={[styles.recFullTitle, { color: colors.textWhite }]}>{data.recommendation.title}</Text>
                  <Text style={[styles.recFullText, { color: colors.textWhite }]}>{data.recommendation.content}</Text>
                </View>
              </SlideInView>

              {/* Row 2: Petrol | Diesel */}
              <SlideInView direction="up" duration={400} delay={80}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {showPetrol && (
                    <View style={[styles.bentoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flex: showDiesel ? 1 : undefined }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.bentoCardLabel, { color: colors.textMuted }]}>Petrol</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Ionicons name={data.trend.petrol === 'up' ? 'trending-up' : 'trending-down'} size={14} color={data.trend.petrol === 'up' ? colors.riskHigh : colors.riskLow} />
                          <Text style={[{ color: data.trend.petrol === 'up' ? colors.riskHigh : colors.riskLow, fontSize: 12, fontWeight: '500' }]}>{data.trend.petrol_change}</Text>
                        </View>
                      </View>
                      <Text style={[styles.bentoCardPrice, { color: colors.textPrimary }]}>
                        Rs {data.current_price.petrol.toFixed(2)}
                        <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                      </Text>
                      <View style={[styles.bentoCardBadge, { backgroundColor: (data.trend.petrol === 'down' ? colors.riskLow : colors.riskModerate) + '20' }]}>
                        <Text style={[styles.bentoCardBadgeText, { color: data.trend.petrol === 'down' ? colors.riskLow : colors.riskModerate }]}>
                          {data.trend.petrol === 'down' ? 'Lowest 7d' : 'Rising'}
                        </Text>
                      </View>
                    </View>
                  )}
                  {showDiesel && (
                    <View style={[styles.bentoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flex: showPetrol ? 1 : undefined }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.bentoCardLabel, { color: colors.textMuted }]}>Diesel</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Ionicons name={data.trend.diesel === 'up' ? 'trending-up' : 'trending-down'} size={14} color={data.trend.diesel === 'up' ? colors.riskHigh : colors.riskLow} />
                          <Text style={[{ color: data.trend.diesel === 'up' ? colors.riskHigh : colors.riskLow, fontSize: 12, fontWeight: '500' }]}>{data.trend.diesel_change}</Text>
                        </View>
                      </View>
                      <Text style={[styles.bentoCardPrice, { color: colors.textPrimary }]}>
                        Rs {data.current_price.diesel.toFixed(2)}
                        <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                      </Text>
                      <View style={[styles.bentoCardBadge, { backgroundColor: (data.trend.diesel === 'up' ? colors.riskHigh : colors.riskLow) + '20' }]}>
                        <Text style={[styles.bentoCardBadgeText, { color: data.trend.diesel === 'up' ? colors.riskHigh : colors.riskLow }]}>
                          {data.trend.diesel === 'up' ? 'Rising' : 'Lowest 7d'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </SlideInView>

              {/* Row 3: Market Sentiment | Next Cycle */}
              <SlideInView direction="up" duration={400} delay={160}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.bentoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, flex: 1 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="analytics" size={16} color={colors.accentPetrol} />
                        <Text style={[styles.bentoCardLabel, { color: colors.textMuted }]}>Market</Text>
                      </View>
                      <Text style={[styles.riskBadge, { color: (colors as any)[`risk${data.risk_level}`] || colors.riskModerate }]}>{data.risk_level} Risk</Text>
                    </View>
                    <View style={{ marginTop: 4 }}>
                      <Text style={[styles.bentoRiskValue, { color: (colors as any)[`risk${data.risk_level}`] || colors.riskModerate }]}>
                        {data.risk_level === 'High' ? 'Volatile' : data.risk_level === 'Moderate' ? 'Stable' : 'Low'}
                      </Text>
                      <View style={styles.miniChart}>
                        {[40, 60, 50, 80, 70, 90].map((h, i) => (
                          <View key={i} style={[styles.miniChartBar, { backgroundColor: (colors as any)[`risk${data.risk_level}`] || colors.riskModerate, height: `${h}%` as any }]} />
                        ))}
                      </View>
                      <Text style={[styles.bentoCardSubtext, { color: colors.textSecondary }]}>30-day outlook: {data.market_update}</Text>
                    </View>
                  </View>

                  {/* Next Cycle + Crude stacked vertically */}
                  <View style={{ flex: 1, gap: 12 }}>
                    <View style={[styles.bentoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calendar" size={16} color={colors.accentPetrol} />
                        <Text style={[styles.bentoCardLabel, { color: colors.textMuted }]}>Next Cycle</Text>
                      </View>
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.bentoCycleDay, { color: colors.accentPetrol }]}>Tuesday</Text>
                        <Text style={[styles.bentoCardSubtext, { color: colors.textSecondary }]}>Best projected day for refilling next week.</Text>
                      </View>
                    </View>

                    {data.global_crude?.brent_usd && (
                      <View style={[styles.bentoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="globe" size={16} color={colors.accentPetrol} />
                          <Text style={[styles.bentoCardLabel, { color: colors.textMuted }]}>Crude Oil</Text>
                        </View>
                        <View style={{ marginTop: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                            <Text style={[styles.bentoCrudePrice, { color: colors.textPrimary }]}>${data.global_crude.brent_usd.toFixed(2)}</Text>
                            <Text style={[styles.bentoCrudeChange, { color: colors.riskHigh }]}>+1.2%</Text>
                          </View>
                          <Text style={[styles.bentoCardSubtext, { color: colors.textSecondary }]}>Brent Crude (USD/bbl)</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </SlideInView>

              {/* Row 4: Daily Fuel Usage (full width like HTML efficiency tip) */}
              <SlideInView direction="up" duration={400} delay={240}>
                <View style={[styles.fuelRowCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
                  <View style={[styles.fuelRowIcon, { backgroundColor: colors.accentPetrol }]}>
                    <Ionicons name="water" size={20} color={colors.textWhite} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bentoCardLabel, { color: colors.accentPetrol, textTransform: 'uppercase', fontSize: 10 }]}>Daily Fuel</Text>
                    <Text style={[styles.bentoCardSubtext, { color: colors.textSecondary, fontStyle: 'italic' }]}>Enter your daily consumption to track costs.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={[styles.fuelRowInput, { backgroundColor: colors.bg, borderColor: colors.borderInput, color: colors.textPrimary }]}
                      value={fuelLiters}
                      onChangeText={setFuelLiters}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Text style={[styles.fuelRowUnit, { color: colors.textMuted }]}>L</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }}>
                    <Text style={[styles.bentoCardLabel, { color: colors.accentPetrol, fontSize: 10 }]}>Est. /wk</Text>
                    <Text style={[styles.fuelRowAmount, { color: colors.accentPetrol }]}>Rs {weeklyFuelCost.toFixed(0)}</Text>
                  </View>
                </View>
              </SlideInView>

              {/* Row 5: Efficiency Tip (full width) */}
              <SlideInView direction="up" duration={400} delay={320}>
                <View style={[styles.fuelRowCard, { backgroundColor: colors.bgSurface, borderWidth: 0 }]}>
                  <View style={[styles.fuelRowIcon, { backgroundColor: colors.accentPetrol }]}>
                    <Ionicons name="leaf" size={20} color={colors.textWhite} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bentoCardLabel, { color: colors.accentPetrol, textTransform: 'uppercase', fontSize: 10 }]}>Efficiency Tip</Text>
                    <Text style={[styles.bentoCardSubtext, { color: colors.textSecondary, fontStyle: 'italic' }]}>Smooth braking can save up to 15% on fuel annually.</Text>
                  </View>
                  <View style={{ borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }}>
                    <Text style={[styles.bentoCardLabel, { color: colors.accentPetrol, fontSize: 10 }]}>Est. Monthly</Text>
                    <Text style={[styles.fuelRowAmount, { color: colors.accentPetrol }]}>Rs {(weeklyFuelCost * 0.15 * 4).toFixed(0)}</Text>
                  </View>
                </View>
              </SlideInView>
            </StaggerContainer>
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1},
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
    borderRadius: 12, flexDirection: 'row',
    overflow: 'hidden', borderWidth: 1,
  },
  bannerAccent: { width: 5 },
  bannerContent: { flex: 1, padding: 18, gap: 6 },
  bannerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 13, lineHeight: 18 },
  priceCard: {
    borderRadius: 12,
    borderWidth: 1, padding: 20, gap: 8,
  },
  priceUnit: { fontSize: 11, fontWeight: '400' },
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

  // New bento styles
  recFullCard: {
    borderRadius: 14, padding: 20,
    flexDirection: 'column', gap: 8,
    overflow: 'hidden', position: 'relative',
    shadowRadius: 20, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  recFullGlow: { position: 'absolute', right: -16, top: -16 },
  recFullLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 },
  recFullTitle: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  recFullText: { fontSize: 14, lineHeight: 20, maxWidth: '90%' },
  bentoCard: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, gap: 8,
  },
  bentoCardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bentoCardPrice: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  bentoCardBadge: {
    alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
  },
  bentoCardBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  riskBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  bentoRiskValue: { fontSize: 18, fontWeight: '700' },
  miniChart: {
    height: 32, width: '100%',
    flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 8, opacity: 0.6,
  },
  miniChartBar: { flex: 1, borderRadius: 2 },
  bentoCardSubtext: { fontSize: 10, lineHeight: 14, marginTop: 6 },
  bentoCycleDay: { fontSize: 18, fontWeight: '700' },
  bentoCrudePrice: { fontSize: 18, fontWeight: '700' },
  bentoCrudeChange: { fontSize: 10, fontWeight: '700' },
  fuelRowCard: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  fuelRowIcon: {
    width: 40, height: 40, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  fuelRowInput: {
    width: 52, height: 38, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 6, fontSize: 14, textAlign: 'center',
  },
  fuelRowUnit: { fontSize: 12, fontWeight: '500' },
  fuelRowAmount: { fontSize: 16, fontWeight: '700' },
});
