import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Switch, TextInput, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { getUserAsync, setUser, clearToken, UserData } from '@/services/auth';
import { api } from '@/services/api';
import { registerForPushNotifications, unregisterPushNotifications } from '@/services/notifications';
import { useAppColor } from '@/hooks/useAppColor';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { changeLanguage, getCurrentLanguage } from '@/i18n';

const FUEL_TYPES = [
  { id: 'petrol', icon: 'car-sport-outline', labelKey: 'register.petrol' },
  { id: 'diesel', icon: 'car-outline', labelKey: 'register.diesel' },
  { id: 'both', icon: 'swap-horizontal-outline', labelKey: 'register.both' },
];

const BIZ_KEY: Record<string, string> = {
  restaurant: 'businessRestaurant',
  taxi: 'businessTaxi',
  delivery: 'businessDelivery',
  retail: 'businessRetail',
  logistics: 'businessLogistics',
};

const BUSINESS_TYPES = [
  { id: 'restaurant', labelKey: 'register.businessRestaurant', icon: 'restaurant-outline' },
  { id: 'taxi', labelKey: 'register.businessTaxi', icon: 'car-outline' },
  { id: 'delivery', labelKey: 'register.businessDelivery', icon: 'cube-outline' },
  { id: 'retail', labelKey: 'register.businessRetail', icon: 'storefront-outline' },
  { id: 'logistics', labelKey: 'register.businessLogistics', icon: 'bus-outline' },
];

export default function ProfileScreen() {
  const [user, setUserState] = useState<UserData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBizType, setEditBizType] = useState('');
  const [editFuelType, setEditFuelType] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [minChangePct, setMinChangePct] = useState(2.0);
  const [alertOnPetrol, setAlertOnPetrol] = useState(true);
  const [alertOnDiesel, setAlertOnDiesel] = useState(true);
  const [currentLang, setCurrentLang] = useState<'en' | 'fr'>(getCurrentLanguage());
  const colors = useAppColor();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    getUserAsync().then(setUserState);
    api.notifications.preferences()
      .then(prefs => {
        setPushEnabled(prefs.push_enabled);
        setMinChangePct(prefs.min_change_pct ?? 2.0);
        setAlertOnPetrol(prefs.alert_on_petrol ?? true);
        setAlertOnDiesel(prefs.alert_on_diesel ?? true);
      })
      .catch(() => {});
  }, []);

  const updatePrefs = (patch: Record<string, unknown>) => {
    api.notifications.updatePreferences(patch).catch(() => {});
  };

  const THRESHOLD_OPTIONS = [1, 2, 5, 10];

  const handleLangChange = (lang: 'en' | 'fr') => {
    setCurrentLang(lang);
    changeLanguage(lang);
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
      showToast({ type: 'error', title: 'Error', message: t('profile.notifError') || 'Failed to update notification settings' });
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

  const startEditing = () => {
    if (!user) return;
    setEditName(user.full_name);
    setEditBizType(user.business_type);
    setEditFuelType(user.fuel_type || 'petrol');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      showToast({ type: 'warning', title: 'Validation', message: 'Name cannot be empty' });
      return;
    }
    setSaving(true);
    try {
      const updated = await api.profile.update({
        full_name: editName.trim(),
        business_type: editBizType,
        fuel_type: editFuelType,
      });
      await setUser(updated);
      setUserState(prev => prev ? { ...prev, ...updated } : updated);
      setEditing(false);
      showToast({ type: 'success', title: 'Success', message: 'Profile updated successfully' });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err.detail || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      const res = await api.profile.uploadAvatar(result.assets[0].uri);
      const updatedUser = { ...user!, avatar_url: res.avatar_url };
      await setUser(updatedUser);
      setUserState(updatedUser);
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err.detail || 'Failed to upload avatar' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="gas-station-outline" size={22} color={colors.accentPetrol} />
          <Text style={[styles.headerTitle, { color: colors.accentPetrol }]}>{t('profile.header')}</Text>
        </View>
        {!editing ? (
          <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
            <Ionicons name="create-outline" size={20} color={colors.accentPetrol} />
            <Text style={[styles.editBtnText, { color: colors.accentPetrol }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={cancelEditing}>
            <Text style={[styles.editBtnText, { color: colors.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : user?.full_name ? (
              <View style={[styles.avatar, { backgroundColor: colors.accentPetrol }]}>
                <Text style={[styles.avatarText, { color: colors.textWhite }]}>
                  {user.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <Ionicons name="person-circle-outline" size={72} color={colors.accentPetrol} />
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.accentPetrol }]}>
              <Ionicons name="camera" size={14} color={colors.textWhite} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.name, { color: colors.textPrimary }]}>{editing ? editName : (user?.full_name || t('profile.user'))}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email || ''}</Text>
        </View>

        {editing && (
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.accentPetrol }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.fullName')}</Text>
              <TextInput
                style={[styles.editInlineInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.email')}</Text>
              <Text style={[styles.infoValue, { color: colors.textMuted }]}>{user?.email || '\u2014'}</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
            <Text style={[styles.editSectionTitle, { color: colors.textSecondary }]}>{t('register.businessTypeLabel')}</Text>
            <View style={styles.chipGrid}>
              {BUSINESS_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt.id}
                  style={[styles.chip, { borderColor: editBizType === bt.id ? colors.accentPetrol : colors.borderInput, backgroundColor: editBizType === bt.id ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => setEditBizType(bt.id)}
                >
                  <Ionicons name={bt.icon as any} size={18} color={editBizType === bt.id ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.chipLabel, { color: editBizType === bt.id ? colors.accentPetrol : colors.textSecondary }]}>
                    {t(bt.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
            <Text style={[styles.editSectionTitle, { color: colors.textSecondary }]}>{t('register.fuelTypeLabel')}</Text>
            <View style={styles.chipGrid}>
              {FUEL_TYPES.map((ft) => (
                <TouchableOpacity
                  key={ft.id}
                  style={[styles.chip, { borderColor: editFuelType === ft.id ? colors.accentPetrol : colors.borderInput, backgroundColor: editFuelType === ft.id ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => setEditFuelType(ft.id)}
                >
                  <Ionicons name={ft.icon as any} size={18} color={editFuelType === ft.id ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.chipLabel, { color: editFuelType === ft.id ? colors.accentPetrol : colors.textSecondary }]}>
                    {t(ft.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.borderInput }]}
                onPress={cancelEditing}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accentPetrol }, saving && { opacity: 0.7 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.textWhite }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!editing && (
          <>
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
              <View style={[styles.divider, { backgroundColor: colors.bgSurface }]} />
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('register.fuelTypeLabel')}</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {user?.fuel_type ? t(`register.${user.fuel_type}`) : '\u2014'}
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
                {pushEnabled ? t('profile.notifEnabled') : t('profile.notifDisabled')}
              </Text>
            </View>

            {pushEnabled && (
              <View style={[styles.notifCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.notifHeader}>
                  <View style={styles.notifHeaderLeft}>
                    <Ionicons name="trending-down-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{t('profile.minChange')}</Text>
                  </View>
                </View>
                <View style={styles.thresholdRow}>
                  {THRESHOLD_OPTIONS.map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.thresholdBtn, {
                        borderColor: minChangePct === pct ? colors.accentPetrol : colors.borderInput,
                        backgroundColor: minChangePct === pct ? colors.bgPrimaryLight : colors.bgSurface,
                      }]}
                      onPress={() => { setMinChangePct(pct); updatePrefs({ min_change_pct: pct }); }}
                    >
                      <Text style={[styles.thresholdBtnText, {
                        color: minChangePct === pct ? colors.accentPetrol : colors.textSecondary,
                        fontWeight: minChangePct === pct ? '700' : '500',
                      }]}>{pct}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.fuelToggleRow}>
                  <TouchableOpacity
                    style={[styles.fuelToggleChip, {
                      borderColor: alertOnPetrol ? colors.accentPetrol : colors.borderInput,
                      backgroundColor: alertOnPetrol ? colors.bgPrimaryLight : colors.bgSurface,
                    }]}
                    onPress={() => { setAlertOnPetrol(!alertOnPetrol); updatePrefs({ alert_on_petrol: !alertOnPetrol }); }}
                  >
                    <MaterialCommunityIcons name="gas-station-outline" size={16} color={alertOnPetrol ? colors.accentPetrol : colors.textMuted} />
                    <Text style={[styles.fuelToggleLabel, { color: alertOnPetrol ? colors.accentPetrol : colors.textMuted }]}>{t('register.petrol')}</Text>
                    {alertOnPetrol && <Ionicons name="checkmark-circle" size={16} color={colors.accentPetrol} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fuelToggleChip, {
                      borderColor: alertOnDiesel ? colors.accentPetrol : colors.borderInput,
                      backgroundColor: alertOnDiesel ? colors.bgPrimaryLight : colors.bgSurface,
                    }]}
                    onPress={() => { setAlertOnDiesel(!alertOnDiesel); updatePrefs({ alert_on_diesel: !alertOnDiesel }); }}
                  >
                    <MaterialCommunityIcons name="engine-outline" size={16} color={alertOnDiesel ? colors.accentPetrol : colors.textMuted} />
                    <Text style={[styles.fuelToggleLabel, { color: alertOnDiesel ? colors.accentPetrol : colors.textMuted }]}>{t('register.diesel')}</Text>
                    {alertOnDiesel && <Ionicons name="checkmark-circle" size={16} color={colors.accentPetrol} />}
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
                {theme === 'dark' ? t('profile.darkActive') : t('profile.darkInactive')}
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
              <Text style={[styles.surveyText, { color: colors.textSecondary }]}>{t('profile.surveyDesc')}</Text>
            </TouchableOpacity>

            <View style={[styles.appInfoCard, { backgroundColor: colors.bgInsight }]}>
              <Text style={[styles.appInfoTitle, { color: colors.accentPetrol }]}>{t('profile.appInfo')}</Text>
              <Text style={[styles.appInfoVersion, { color: colors.textMuted }]}>{t('profile.version')}</Text>
              <Text style={[styles.appInfoDesc, { color: colors.textSecondary }]}>{t('profile.appDescription')}</Text>
            </View>

            <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.bgCard, borderColor: colors.trendUp }]} onPress={handleLogout}>
              <Text style={[styles.logoutText, { color: colors.trendUp }]}>{t('profile.logout')}</Text>
            </TouchableOpacity>
          </>
        )}
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
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  editBtnText: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 24, paddingBottom: 32 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14 },
  editInlineInput: {
    fontSize: 14, fontWeight: '600', textAlign: 'right',
    borderBottomWidth: 1, paddingVertical: 2, minWidth: 120, paddingHorizontal: 4,
  },
  editSectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 24, gap: 12 },
  infoTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1 },
  notifCard: { borderRadius: 12, borderWidth: 1, padding: 20, gap: 8 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { fontSize: 15, fontWeight: '600' },
  notifText: { fontSize: 13, lineHeight: 18 },
  thresholdRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  thresholdBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  thresholdBtnText: { fontSize: 14 },
  fuelToggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  fuelToggleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  fuelToggleLabel: { fontSize: 13, fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  langBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  langBtnText: { fontSize: 14, fontWeight: '600' },
  surveyCard: {
    borderRadius: 12, borderWidth: 1, borderLeftWidth: 4,
    padding: 20, gap: 8,
  },
  surveyIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surveyBadge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase' },
  surveyTitle: { fontSize: 16, fontWeight: '700' },
  surveyText: { fontSize: 14, lineHeight: 20 },
  appInfoCard: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 4 },
  appInfoTitle: { fontSize: 18, fontWeight: '700' },
  appInfoVersion: { fontSize: 12 },
  appInfoDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  logoutButton: { height: 48, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
