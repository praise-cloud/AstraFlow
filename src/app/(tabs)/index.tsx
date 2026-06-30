import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '@/services/api';
import { getUser } from '@/services/auth';
import { Sparkline } from '@/components/Sparkline';
import { useAppColor } from '@/hooks/useAppColor';
import { getCurrentLanguage } from '@/i18n';

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
  url: string | null;
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
      setError(err.detail || t('home.errorDashboard'));
      if (!data) setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [data]);

  const fetchNews = useCallback(async () => {
    try {
      const articles = await api.news.list();
      setNews(articles);
    } catch (e) {
      console.error('News fetch failed:', e);
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
      if (err.status !== 401) setError(err.detail || t('home.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, []);

  const user = getUser();

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
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPetrol} />}
      >
        {loading && !data ? (
          <View style={styles.scrollContent}>
            <View style={[styles.bannerCard, { backgroundColor: colors.bgBanner, borderColor: colors.borderLight }]}>
              <View style={{ width: 80, height: 10, backgroundColor: colors.bgSkeleton, borderRadius: 4 }} />
              <View style={{ width: '60%', height: 18, backgroundColor: colors.bgSkeleton, borderRadius: 4 }} />
            </View>
            <View style={styles.priceGrid}>
              <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ height: 14, width: '50%', backgroundColor: colors.bgSkeleton, borderRadius: 4 }} />
                <View style={{ height: 22, width: '70%', backgroundColor: colors.bgSkeleton, borderRadius: 4, marginTop: 6 }} />
              </View>
              <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={{ height: 14, width: '50%', backgroundColor: colors.bgSkeleton, borderRadius: 4 }} />
                <View style={{ height: 22, width: '70%', backgroundColor: colors.bgSkeleton, borderRadius: 4, marginTop: 6 }} />
              </View>
            </View>
          </View>
        ) : data ? (
          <>
            {error && (
              <TouchableOpacity style={[styles.errorBanner, { backgroundColor: colors.bgError }]} onPress={fetchDashboard}>
                <Text style={[styles.errorText, { color: colors.textError }]}>{error}</Text>
                <Text style={[styles.retryText, { color: colors.textError }]}>{t('common.retry')}</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.bannerCard, { backgroundColor: colors.bgBanner, borderColor: colors.borderLight }]}>
              <View style={[styles.bannerAccent, { backgroundColor: colors.accentPetrol }]} />
              <View style={styles.bannerContent}>
                <Text style={[styles.bannerLabel, { color: colors.accentPetrol }]}>{t('home.recommendation')}</Text>
                <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>{data.recommendation.title}</Text>
                <Text style={[styles.bannerText, { color: colors.textSecondary }]}>{data.recommendation.content}</Text>
              </View>
            </View>

            <View style={styles.priceGrid}>
              <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderTopColor: colors.accentPetrol, borderTopWidth: 3 }]}>
                <View style={styles.priceHeader}>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>{t('common.petrol')}</Text>
                  <View style={styles.trendRow}>
                    {data.trend.petrol === 'up' ? (
                      <Ionicons name="arrow-up" size={13} color={colors.trendUp} />
                    ) : (
                      <Ionicons name="arrow-down" size={13} color={colors.trendDown} />
                    )}
                    <Text style={[data.trend.petrol === 'up' ? { color: colors.trendUp } : { color: colors.trendDown }, { fontSize: 12, fontWeight: '600' }]}>
                      {data.trend.petrol_change}%
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <View>
                    <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                      Rs {data.current_price.petrol.toFixed(2)}
                      <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                    </Text>
                    <Text style={[styles.priceSub, { color: colors.textMuted }]}>{t('common.perLitre')}</Text>
                  </View>
                  <Sparkline
                    data={makeSparklineSmooth(data.current_price.petrol, data.trend.petrol, data.trend.petrol_change)}
                    width={70}
                    height={36}
                    color={colors.accentPetrol}
                    strokeWidth={2}
                  />
                </View>
              </View>

              <View style={[styles.priceCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderTopColor: colors.accentDiesel, borderTopWidth: 3 }]}>
                <View style={styles.priceHeader}>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>{t('common.diesel')}</Text>
                  <View style={styles.trendRow}>
                    {data.trend.diesel === 'up' ? (
                      <Ionicons name="arrow-up" size={13} color={colors.trendUp} />
                    ) : (
                      <Ionicons name="arrow-down" size={13} color={colors.trendDown} />
                    )}
                    <Text style={[data.trend.diesel === 'up' ? { color: colors.trendUp } : { color: colors.trendDown }, { fontSize: 12, fontWeight: '600' }]}>
                      {data.trend.diesel_change}%
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBody}>
                  <View>
                    <Text style={[styles.priceValue, { color: colors.textPrimary }]}>
                      Rs {data.current_price.diesel.toFixed(2)}
                      <Text style={[styles.priceUnit, { color: colors.textMuted }]}>/{data.current_price.unit}</Text>
                    </Text>
                    <Text style={[styles.priceSub, { color: colors.textMuted }]}>{t('common.perLitre')}</Text>
                  </View>
                  <Sparkline
                    data={makeSparklineSmooth(data.current_price.diesel, data.trend.diesel, data.trend.diesel_change)}
                    width={70}
                    height={36}
                    color={colors.accentDiesel}
                    strokeWidth={2}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.fuelUsageCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.fuelUsageHeader}>
                <Text style={[styles.fuelUsageTitle, { color: colors.textPrimary }]}>{t('home.yourFuelUsage')}</Text>
                <TouchableOpacity style={[styles.refillBtn, { backgroundColor: colors.accentPetrol }]} onPress={() => setShowRefillModal(true)}>
                  <Text style={[styles.refillBtnText, { color: colors.textWhite }]}>{t('home.refillBtn')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fuelUsageGrid}>
                <View style={styles.fuelUsageItem}>
                  <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.dailyUsage')}</Text>
                  <Text style={[styles.fuelUsageValue, { color: colors.textPrimary }]}>{fuelLiters} L</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.estDriven')}</Text>
                  <Text style={[styles.fuelUsageValue, { color: colors.textPrimary }]}>{kmDriven || dailyEstKm} km/day</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.weeklyCost')}</Text>
                  <Text style={[styles.fuelUsageValue, { color: colors.textPrimary }]}>Rs {weeklyFuelCost.toFixed(0)}</Text>
                </View>
                <View style={styles.fuelUsageItem}>
                  <Text style={[styles.fuelUsageLabel, { color: colors.textMuted }]}>{t('home.lastRefill')}</Text>
                  <Text style={[styles.fuelUsageValue, { color: colors.textPrimary }]}>{lastRefill ? formatDate(lastRefill) : '—'}</Text>
                </View>
              </View>
              <View style={styles.fuelUsageRow}>
                <Text style={[styles.fuelUsageHint, { color: colors.textMuted }]}>{t('home.dailyConsumption')}</Text>
                <View style={styles.fuelInputRow}>
                  <TextInput
                    style={[styles.fuelInput, { backgroundColor: colors.bg, borderColor: colors.borderInput, color: colors.textPrimary }]}
                    value={fuelLiters}
                    onChangeText={setFuelLiters}
                    keyboardType="numeric"
                    placeholder={t('home.dailyPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={[styles.fuelInputUnit, { color: colors.textMuted }]}>{t('common.litre')}</Text>
                </View>
              </View>
            </View>

            {/* <View style={[styles.insightCard, { backgroundColor: colors.bgInsight, borderColor: colors.borderSubtle }]}>
              <View style={[styles.insightIconContainer, { backgroundColor: colors.accentPetrol }]}>
                <Ionicons name="bulb-outline" size={18} color={colors.textWhite} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>Market Update</Text>
                <Text style={[styles.insightText, { color: colors.textSecondary }]}>{data.market_update}</Text>
              </View>
            </View> */}

            {data.global_crude?.brent_usd && (
              <View style={[styles.globalCrudeCard, { backgroundColor: colors.crudeBg, borderColor: colors.crudeDivider }]}>
                <View style={styles.globalCrudeHeader}>
                  <Ionicons name="globe-outline" size={16} color={colors.crudeText} />
                  <Text style={[styles.globalCrudeTitle, { color: colors.crudeText }]}> {t('home.globalCrude')}</Text>
                </View>
                <View style={styles.globalCrudeRow}>
                  <View style={styles.globalCrudeItem}>
                    <Text style={[styles.globalCrudeLabel, { color: colors.crudeLabel }]}>Brent</Text>
                    <Text style={[styles.globalCrudeValue, { color: colors.crudeValue }]}>${data.global_crude.brent_usd.toFixed(2)}</Text>
                    <Text style={[styles.globalCrudeUnit, { color: colors.crudeText }]}>{t('home.bbl')}</Text>
                  </View>
                  <View style={[styles.globalCrudeDivider, { backgroundColor: colors.crudeDivider }]} />
                  <View style={styles.globalCrudeItem}>
                    <Text style={[styles.globalCrudeLabel, { color: colors.crudeLabel }]}>WTI</Text>
                    <Text style={[styles.globalCrudeValue, { color: colors.crudeValue }]}>${data.global_crude.wti_usd?.toFixed(2)}</Text>
                    <Text style={[styles.globalCrudeUnit, { color: colors.crudeText }]}>{t('home.bbl')}</Text>
                  </View>
                  <View style={[styles.globalCrudeDivider, { backgroundColor: colors.crudeDivider }]} />
                  <View style={styles.globalCrudeItem}>
                    <Text style={[styles.globalCrudeLabel, { color: colors.crudeLabel }]}>Gasoline</Text>
                    <Text style={[styles.globalCrudeValue, { color: colors.crudeValue }]}>${data.global_crude.gasoline_global_usd?.toFixed(2)}</Text>
                    <Text style={[styles.globalCrudeUnit, { color: colors.crudeText }]}>{t('home.gal')}</Text>
                  </View>
                </View>
                <View style={[styles.mauritiusImpact, { backgroundColor: colors.bgMauritiusImpact }]}>
                  <Text style={[styles.impactTitle, { color: colors.crudeText }]}>{t('home.impactTitle')}</Text>
                  <Text style={[styles.impactText, { color: colors.impactText }]}>
                    Brent crude at ${data.global_crude.brent_usd.toFixed(2)}/bbl {data.trend.petrol === 'up' ? 'pushes' : 'eases'} local retail prices.
                    Mauritius imports refined petroleum — every ${data.trend.petrol === 'up' ? 'rise' : 'drop'} in crude reflects at the pump within 2-3 weeks.
                  </Text>
                </View>
                <Text style={[styles.globalCrudeSource, { color: colors.crudeSource }]}>via {data.global_crude.source}</Text>
              </View>
            )}

            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('home.fuelRisk')}</Text>
                <View style={[styles.metricBarTrack, { backgroundColor: colors.barTrack }]}>
                  <View style={[styles.metricBarFill, { width: `${riskPct}%`, backgroundColor: colors[`risk${data.risk_level}` as keyof typeof colors] || colors.riskModerate }]} />
                </View>
                <Text style={[styles.metricValue, { color: (colors as any)[`risk${data.risk_level}`] || colors.riskModerate }]}>
                  {data.risk_level} · {riskPct.toFixed(0)}%
                </Text>
                <Text style={[styles.metricSub, { color: colors.textMuted }]}>{t('home.basedOnTrend')}</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('home.businessImpact')}</Text>
                <View style={[styles.metricBarTrack, { backgroundColor: colors.barTrack }]}>
                  <View style={[styles.metricBarFill, { width: `${impactPct}%`, backgroundColor: impactPct > 50 ? colors.riskHigh : impactPct > 25 ? colors.riskModerate : colors.riskLow }]} />
                </View>
                <Text style={[styles.metricValue, { color: impactPct > 50 ? colors.riskHigh : impactPct > 25 ? colors.riskModerate : colors.riskLow }]}>
                  {data.impact_score} · {impactPct.toFixed(0)}%
                </Text>
                <Text style={[styles.metricSub, { color: colors.textMuted }]}>{t('home.weeklySpend', { amount: weeklyFuelCost.toFixed(0) })}</Text>
              </View>
            </View>

            <View style={[styles.newsSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.newsSectionTitle, { color: colors.textPrimary }]}>{t('home.newsSection')}</Text>
              {newsLoading ? (
                <View style={{ gap: 12 }}>
                  <View style={{ height: 60, backgroundColor: colors.bgSkeleton, borderRadius: 8 }} />
                  <View style={{ height: 60, backgroundColor: colors.bgSkeleton, borderRadius: 8 }} />
                </View>
              ) : news.length === 0 ? (
                <Text style={[styles.newsEmpty, { color: colors.textMuted }]}>{t('home.noNews')}</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {news.map(article => (
                    <TouchableOpacity
                      key={article.id}
                      style={[styles.newsCard, { backgroundColor: colors.bgSurface, borderColor: colors.bgSurface }]}
                      onPress={() => setSelectedNews(article)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.newsTitle, { color: colors.textPrimary }]}>{article.title}</Text>
                      <Text style={[styles.newsSummary, { color: colors.textSecondary }]} numberOfLines={2}>{article.summary}</Text>
                      <View style={styles.newsMeta}>
                        <Text style={[styles.newsSource, { color: colors.textLink }]}>{article.source}</Text>
                        <Text style={[styles.newsDate, { color: colors.textMuted }]}>{article.published_at}</Text>
                      </View>
                      <Text style={[styles.newsRead, { color: colors.textLink }]}>{t('common.read')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showRefillModal} transparent animationType="slide" onRequestClose={() => setShowRefillModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.bgModalOverlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.bgElevated }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('home.logRefill')}</Text>
              <TouchableOpacity onPress={() => setShowRefillModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.refillLabel, { color: colors.textSecondary }]}>{t('home.litersRefilled')}</Text>
              <TextInput
                style={[styles.refillInput, { backgroundColor: colors.bg, borderColor: colors.borderInput, color: colors.textPrimary }]}
                value={refillAmount}
                onChangeText={setRefillAmount}
                keyboardType="numeric"
                placeholder={t('home.refillPlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.refillSubmit, { backgroundColor: colors.accentPetrol }, !refillAmount && { opacity: 0.5 }]}
                disabled={!refillAmount}
                onPress={() => {
                  setFuelLiters(refillAmount);
                  setLastRefill(new Date());
                  setShowRefillModal(false);
                  setRefillAmount('');
                }}
              >
                <Text style={[styles.refillSubmitText, { color: colors.textWhite }]}>{t('home.logRefillBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedNews !== null} transparent animationType="slide" onRequestClose={() => setSelectedNews(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.bgModalOverlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.bgElevated }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalSource, { color: colors.textLink }]}>{selectedNews?.source}</Text>
              <TouchableOpacity onPress={() => setSelectedNews(null)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.newsDetailTitle, { color: colors.textPrimary }]}>{selectedNews?.title}</Text>
              <Text style={[styles.newsDetailDate, { color: colors.textMuted }]}>{selectedNews?.published_at}</Text>
              <View style={[styles.modalDivider, { backgroundColor: colors.bgSurface }]} />
              <Text style={[styles.newsDetailContent, { color: colors.textPrimary }]}>{selectedNews?.content}</Text>
              {selectedNews?.url ? (
                <TouchableOpacity
                  style={[styles.readArticleBtn, { backgroundColor: colors.accentPetrol }]}
                  onPress={() => Linking.openURL(selectedNews.url!)}
                >
                  <Ionicons name="open-outline" size={16} color={colors.textWhite} />
                  <Text style={[styles.readArticleBtnText, { color: colors.textWhite }]}>{t('home.readArticle')}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  errorBanner: {
    padding: 12, borderRadius: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  errorText: { fontSize: 13, flex: 1 },
  retryText: { fontSize: 12, fontWeight: '600', marginLeft: 8 },

  bannerCard: {
    borderRadius: 10, flexDirection: 'row',
    overflow: 'hidden', borderWidth: 1,
  },
  bannerAccent: { width: 5 },
  bannerContent: { flex: 1, padding: 14, gap: 4 },
  bannerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 13, lineHeight: 18 },

  priceGrid: { flexDirection: 'row', gap: 10 },
  priceCard: {
    flex: 1, borderRadius: 10,
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
  fuelUsageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelUsageTitle: { fontSize: 14, fontWeight: '700' },
  refillBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  refillBtnText: { fontSize: 12, fontWeight: '600' },
  fuelUsageGrid: { flexDirection: 'row', gap: 8 },
  fuelUsageItem: { flex: 1, alignItems: 'center', gap: 2 },
  fuelUsageLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  fuelUsageValue: { fontSize: 14, fontWeight: '700' },
  fuelUsageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelUsageHint: { fontSize: 12 },
  fuelInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fuelInput: {
    width: 60, height: 42, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, fontSize: 14, textAlign: 'center',
  },
  fuelInputUnit: { fontSize: 12 },

  insightCard: {
    borderRadius: 8, padding: 14,
    flexDirection: 'row', gap: 12, borderWidth: 1,
  },
  insightIconContainer: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  insightContent: { flex: 1, gap: 4 },
  insightTitle: { fontSize: 13, fontWeight: '600' },
  insightText: { fontSize: 13, lineHeight: 18 },

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

  newsSection: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, gap: 12,
  },
  newsSectionTitle: {
    fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  newsEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  newsCard: {
    borderRadius: 8, borderWidth: 1,
    padding: 12, gap: 4,
  },
  newsTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  newsSummary: { fontSize: 13, lineHeight: 17 },
  newsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  newsSource: { fontSize: 11, fontWeight: '600' },
  newsDate: { fontSize: 11 },
  newsRead: { fontSize: 13, fontWeight: '600', marginTop: 4 },

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
  globalCrudeUnit: { fontSize: 11 },
  globalCrudeDivider: { width: 1, height: 36 },
  globalCrudeSource: { fontSize: 10, textAlign: 'center' },
  mauritiusImpact: {
    borderRadius: 8, padding: 12, gap: 4,
  },
  impactTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  impactText: { fontSize: 12, lineHeight: 17 },

  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
  },
  modalSource: { fontSize: 13, fontWeight: '600' },
  modalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  modalDivider: { height: 1, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  refillLabel: { fontSize: 14, fontWeight: '600' },
  refillInput: {
    height: 48, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 16, fontSize: 16,
  },
  refillSubmit: {
    height: 48, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  refillSubmitText: { fontSize: 16, fontWeight: '600' },
  newsDetailTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 8 },
  newsDetailDate: { fontSize: 12, marginBottom: 12 },
  newsDetailContent: { fontSize: 15, lineHeight: 24 },
  readArticleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, marginTop: 20,
  },
  readArticleBtnText: { fontSize: 15, fontWeight: '600' },
});
