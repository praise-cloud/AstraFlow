import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { getUserAsync, clearToken } from '@/services/auth';
import { api } from '@/services/api';
import { registerForPushNotifications, unregisterPushNotifications } from '@/services/notifications';
import { useAppColor } from '@/hooks/useAppColor';
import { useTheme } from '@/context/ThemeContext';
import { changeLanguage, getCurrentLanguage } from '@/i18n';

export default function ProfileScreen() {
  const [user, setUser] = useState<{ id: string; email: string; full_name: string; business_type: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [currentLang, setCurrentLang] = useState<'en' | 'fr'>(getCurrentLanguage());
  const colors = useAppColor();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    getUserAsync().then(setUser);
    api.notifications.preferences().then(prefs => setPushEnabled(prefs.push_enabled)).catch(() => {});
  }, []);

  const handleLangChange = (lang: 'en' | 'fr') => {
    setCurrentLang(lang);
    changeLanguage(lang);
  };

  const BIZ_KEY: Record<string, string> = {
    restaurant: 'businessRestaurant',
    taxi: 'businessTaxi',
    delivery: 'businessDelivery',
    retail: 'businessRetail',
    logistics: 'businessLogistics',
  };

  const handleTogglePush = async (value: boolean) => {
    setToggling(true);
    try {
      if (value) {
        await registerForPushNotifications();
      } else {
        await unregisterPushNotifications();
      }
      setPushEnabled(value);
    } catch {
      Alert.alert('Error', t('profile.notifError') || 'Failed to update notification settings');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="gas-station-outline" size={22} color={colors.accentPetrol} />
          <Text style={[styles.headerTitle, { color: colors.accentPetrol }]}>{t('profile.header')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.brandHero, { backgroundColor: colors.bgInsight }]}>
          <View style={[styles.brandHeroIcon, { backgroundColor: colors.accentPetrol }]}>
            <MaterialCommunityIcons name="gas-station-outline" size={30} color={colors.textWhite} />
          </View>
          <Text style={[styles.brandHeroTitle, { color: colors.accentPetrol }]}>{t('common.appName')}</Text>
          <Text style={[styles.brandHeroTagline, { color: colors.textSecondary }]}>{t('common.tagline')}</Text>
        </View>

        <View style={styles.avatarSection}>
          {user?.full_name ? (
            <View style={[styles.avatar, { backgroundColor: colors.accentPetrol }]}>
              <Text style={[styles.avatarText, { color: colors.textWhite }]}>
                {user.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={60} color={colors.accentPetrol} />
          )}
          <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.full_name || t('profile.user')}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email || ''}</Text>
          {user?.business_type && (
            <View style={[styles.businessTag, { backgroundColor: colors.bgPrimaryLight }]}>
              <Text style={[styles.businessTagText, { color: colors.accentPetrol }]}>
                {t(`register.${BIZ_KEY[user.business_type]}`) || user.business_type}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textSecondary }]}>{t('profile.accountInfo')}</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.fullName')}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.full_name || '\u2014'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.email')}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.email || '\u2014'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.businessType')}</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {user?.business_type ? t(`register.${BIZ_KEY[user.business_type]}`) : '\u2014'}
            </Text>
          </View>
        </View>

        <View style={[styles.notifCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{t('profile.notifications')}</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              disabled={toggling}
              trackColor={{ false: colors.borderInput, true: colors.accentPetrol }}
              thumbColor={colors.textWhite}
            />
          </View>
          <Text style={[styles.notifText, { color: colors.textMuted }]}>
            {pushEnabled
              ? t('profile.notifEnabled')
              : t('profile.notifDisabled')}
          </Text>
        </View>

        <View style={[styles.notifCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderLeft}>
              <Ionicons name={theme === 'dark' ? 'moon' : 'sunny-outline'} size={20} color={colors.textSecondary} />
              <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{t('profile.darkMode')}</Text>
            </View>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.borderInput, true: colors.accentPetrol }}
              thumbColor={colors.textWhite}
            />
          </View>
          <Text style={[styles.notifText, { color: colors.textMuted }]}>
            {theme === 'dark'
              ? t('profile.darkActive')
              : t('profile.darkInactive')}
          </Text>
        </View>

        <View style={[styles.notifCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.notifHeader}>
            <View style={styles.notifHeaderLeft}>
              <Ionicons name="language-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{t('profile.language')}</Text>
            </View>
          </View>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, { borderColor: colors.borderInput }, currentLang === 'en' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight }]}
              onPress={() => handleLangChange('en')}
            >
              <Text style={[styles.langBtnText, { color: currentLang === 'en' ? colors.accentPetrol : colors.textMuted }]}>{t('profile.english')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, { borderColor: colors.borderInput }, currentLang === 'fr' && { borderColor: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight }]}
              onPress={() => handleLangChange('fr')}
            >
              <Text style={[styles.langBtnText, { color: currentLang === 'fr' ? colors.accentPetrol : colors.textMuted }]}>{t('profile.french')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.surveyCard, { backgroundColor: colors.bgCard, borderColor: colors.accentPetrol }]} onPress={() => router.push('/survey')}>
          <View style={styles.surveyIconRow}>
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.surveyBadge, { color: colors.accentPetrol, backgroundColor: colors.bgPrimaryLight }]}>{t('profile.surveyTime')}</Text>
          </View>
          <Text style={[styles.surveyTitle, { color: colors.textPrimary }]}>{t('profile.surveyTitle')}</Text>
          <Text style={[styles.surveyText, { color: colors.textSecondary }]}>
            {t('profile.surveyDesc')}
          </Text>
        </TouchableOpacity>

        <View style={[styles.appInfoCard, { backgroundColor: colors.bgInsight }]}>
          <Text style={[styles.appInfoTitle, { color: colors.accentPetrol }]}>{t('profile.appInfo')}</Text>
          <Text style={[styles.appInfoVersion, { color: colors.textMuted }]}>{t('profile.version')}</Text>
          <Text style={[styles.appInfoDesc, { color: colors.textSecondary }]}>
            {t('profile.appDescription')}
          </Text>
        </View>

        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.bgCard, borderColor: colors.trendUp }]} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.trendUp }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 24,
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
  },
  email: {
    fontSize: 14,
  },
  businessTag: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  businessTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  appInfoCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  appInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  appInfoVersion: {
    fontSize: 12,
  },
  appInfoDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  notifCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifText: {
    fontSize: 13,
    lineHeight: 18,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  surveyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 20,
    gap: 8,
  },
  surveyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  surveyBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  surveyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  logoutButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  brandHero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    borderRadius: 16,
    marginBottom: 8,
  },
  brandHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandHeroTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  brandHeroTagline: {
    fontSize: 13,
  },
});
