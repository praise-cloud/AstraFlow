import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Switch, TextInput, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import type { UserData } from '@/services/auth';
import { getUserAsync, setUser, clearToken } from '@/services/auth';
import { api, avatarUrl } from '@/services/api';
import { registerForPushNotifications, unregisterPushNotifications } from '@/services/notifications';
import { useAppColor } from '@/hooks/useAppColor';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { changeLanguage, getCurrentLanguage } from '@/i18n';

const UNIT_OPTIONS = [
  { id: 'L', labelKey: 'profile.liters', icon: 'resize-outline' },
  { id: 'gal_us', labelKey: 'profile.galUs', icon: 'resize-outline' },
  { id: 'gal_uk', labelKey: 'profile.galUk', icon: 'resize-outline' },
];

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

type ModalType = 'fuel' | 'lang' | 'units' | 'password' | null;

export default function ProfileScreen() {
  const [user, setUserState] = useState<UserData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBizType, setEditBizType] = useState('');
  const [editFuelType, setEditFuelType] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [weeklyInsights, setWeeklyInsights] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [minChangePct, setMinChangePct] = useState(2.0);
  const [alertOnPetrol, setAlertOnPetrol] = useState(true);
  const [alertOnDiesel, setAlertOnDiesel] = useState(true);
  const [currentLang, setCurrentLang] = useState<'en' | 'fr'>(getCurrentLanguage());
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalFuel, setModalFuel] = useState('');
  const [cpCurrentPw, setCpCurrentPw] = useState('');
  const [cpNewPw, setCpNewPw] = useState('');
  const [cpSaving, setCpSaving] = useState(false);
  const colors = useAppColor();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const loadProfile = useCallback(() => {
    api.profile.get()
      .then(profile => {
        setUserState(profile);
        setUser(profile);
      })
      .catch(() => getUserAsync().then(setUserState));
    api.notifications.preferences()
      .then(prefs => {
        setPushEnabled(prefs.push_enabled);
        setWeeklyInsights((prefs as any).weekly_insights ?? false);
        setMinChangePct(prefs.min_change_pct ?? 2.0);
        setAlertOnPetrol(prefs.alert_on_petrol ?? true);
        setAlertOnDiesel(prefs.alert_on_diesel ?? true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadProfile(); }, []);

  const updatePrefs = (patch: Record<string, unknown>) => {
    api.notifications.updatePreferences(patch).catch(() => {});
  };

  const THRESHOLD_OPTIONS = [1, 2, 5, 10];

  const handleLangChange = (lang: 'en' | 'fr') => {
    setCurrentLang(lang);
    changeLanguage(lang);
    setActiveModal(null);
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

  const handleToggleInsights = (value: boolean) => {
    setWeeklyInsights(value);
    updatePrefs({ weekly_insights: value });
  };

  const handleChangePassword = async () => {
    if (!cpCurrentPw || !cpNewPw) {
      showToast({ type: 'warning', title: 'Validation', message: 'Please fill in both fields' });
      return;
    }
    if (cpNewPw.length < 6) {
      showToast({ type: 'warning', title: 'Validation', message: t('profile.passwordTooShort') });
      return;
    }
    setCpSaving(true);
    try {
      await api.profile.changePassword({ current_password: cpCurrentPw, new_password: cpNewPw });
      setActiveModal(null);
      setCpCurrentPw('');
      setCpNewPw('');
      showToast({ type: 'success', title: 'Success', message: t('profile.passwordChanged') });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err.detail || t('profile.passwordError') });
    } finally {
      setCpSaving(false);
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

  const openFuelModal = () => {
    setModalFuel(editing ? editFuelType : (user?.fuel_type || 'petrol'));
    setActiveModal('fuel');
  };

  const handleUnitChange = (unit: string) => {
    const updated = { ...user!, preferred_unit: unit };
    setUserState(updated);
    setUser(updated);
    api.profile.update({ preferred_unit: unit }).catch(() => {});
    setActiveModal(null);
  };

  const confirmFuel = () => {
    if (editing) {
      setEditFuelType(modalFuel);
    } else {
      const updated = { ...user!, fuel_type: modalFuel };
      setUserState(updated);
      setUser(updated);
      api.profile.update({ fuel_type: modalFuel }).catch(() => {});
    }
    setActiveModal(null);
  };

  const selectableItem = (items: { id: string; labelKey: string }[], selectedId: string, onSelect: (id: string) => void) => (
    <View style={{ gap: 2 }}>
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.modalRow, isSelected && { backgroundColor: colors.bgPrimaryLight }]}
            onPress={() => onSelect(item.id)}
          >
            <Text style={[styles.modalRowText, { color: colors.textPrimary }, isSelected && { color: colors.accentPetrol, fontWeight: '700' }]}>
              {t(item.labelKey)}
            </Text>
            {isSelected && <Ionicons name="checkmark" size={20} color={colors.accentPetrol} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
            {user?.avatar_url ? (
              <Image source={{ uri: avatarUrl(user.avatar_url) ?? undefined }} style={styles.avatar} />
            ) : user?.full_name ? (
              <View style={[styles.avatar, { backgroundColor: colors.accentPetrol }]}>
                <Text style={[styles.avatarText, { color: colors.textWhite }]}>
                  {user.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name="person" size={36} color={colors.textMuted} />
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: colors.accentPetrol }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.nameText, { color: colors.textPrimary }]}>
            {user?.full_name || 'User'}
          </Text>
          <Text style={[styles.emailText, { color: colors.textMuted }]}>
            {user?.email || ''}
          </Text>
        </View>

        {editing && (
          <View style={[styles.editCard, { backgroundColor: colors.bgCard, borderColor: colors.accentPetrol }]}>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Business Type</Text>
            <View style={styles.chipGrid}>
              {BUSINESS_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt.id}
                  style={[styles.chip, { borderColor: editBizType === bt.id ? colors.accentPetrol : colors.borderInput, backgroundColor: editBizType === bt.id ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => setEditBizType(bt.id)}
                >
                  <Ionicons name={bt.icon as any} size={16} color={editBizType === bt.id ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.chipLabel, { color: editBizType === bt.id ? colors.accentPetrol : colors.textSecondary }]}>{t(bt.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Fuel Type</Text>
            <View style={styles.chipGrid}>
              {FUEL_TYPES.map((ft) => (
                <TouchableOpacity
                  key={ft.id}
                  style={[styles.chip, { borderColor: editFuelType === ft.id ? colors.accentPetrol : colors.borderInput, backgroundColor: editFuelType === ft.id ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => setEditFuelType(ft.id)}
                >
                  <Ionicons name={ft.icon as any} size={16} color={editFuelType === ft.id ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.chipLabel, { color: editFuelType === ft.id ? colors.accentPetrol : colors.textSecondary }]}>{t(ft.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.editActionBtn, { borderColor: colors.border }]} onPress={cancelEditing}>
                <Text style={[styles.editActionCancel, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editActionBtn, { backgroundColor: colors.accentPetrol }]} onPress={saveProfile} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.editActionSave, { color: '#fff' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ gap: 20 }}>
          <Section title="Personal Info" colors={colors}>
            <SettingsRow
              icon="person-outline"
              label="Edit Profile"
              colors={colors}
              onPress={startEditing}
            />
            <Divider colors={colors} />
            <SettingsRow
              icon="lock-closed-outline"
              label={t('profile.changePassword')}
              colors={colors}
              onPress={() => { setCpCurrentPw(''); setCpNewPw(''); setActiveModal('password'); }}
            />
          </Section>

          <Section title="Notifications" colors={colors}>
            <SettingsRowToggle
              icon="notifications-outline"
              label="Price Alert"
              value={pushEnabled}
              onValueChange={handleTogglePush}
              disabled={toggling}
              colors={colors}
            />
            <Divider colors={colors} />
            <SettingsRowToggle
              icon="trending-up-outline"
              label="Weekly Insights"
              value={weeklyInsights}
              onValueChange={handleToggleInsights}
              colors={colors}
            />
          </Section>

          {pushEnabled && (
            <View style={[styles.thresholdCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
              <View style={styles.thresholdRow}>
                {THRESHOLD_OPTIONS.map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.thresholdChip, {
                      borderColor: minChangePct === pct ? colors.accentPetrol : colors.borderInput,
                      backgroundColor: minChangePct === pct ? colors.bgPrimaryLight : colors.bgSurface,
                    }]}
                    onPress={() => { setMinChangePct(pct); updatePrefs({ min_change_pct: pct }); }}
                  >
                    <Text style={[styles.thresholdChipText, { color: minChangePct === pct ? colors.accentPetrol : colors.textSecondary, fontWeight: minChangePct === pct ? '700' : '500' }]}>{pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.fuelToggleRow}>
                <TouchableOpacity
                  style={[styles.fuelToggleChip, { borderColor: alertOnPetrol ? colors.accentPetrol : colors.borderInput, backgroundColor: alertOnPetrol ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => { setAlertOnPetrol(!alertOnPetrol); updatePrefs({ alert_on_petrol: !alertOnPetrol }); }}
                >
                  <Ionicons name="car-sport-outline" size={16} color={alertOnPetrol ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.fuelToggleLabel, { color: alertOnPetrol ? colors.accentPetrol : colors.textMuted }]}>Petrol</Text>
                  {alertOnPetrol && <Ionicons name="checkmark-circle" size={16} color={colors.accentPetrol} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fuelToggleChip, { borderColor: alertOnDiesel ? colors.accentPetrol : colors.borderInput, backgroundColor: alertOnDiesel ? colors.bgPrimaryLight : colors.bgSurface }]}
                  onPress={() => { setAlertOnDiesel(!alertOnDiesel); updatePrefs({ alert_on_diesel: !alertOnDiesel }); }}
                >
                  <Ionicons name="car-outline" size={16} color={alertOnDiesel ? colors.accentPetrol : colors.textMuted} />
                  <Text style={[styles.fuelToggleLabel, { color: alertOnDiesel ? colors.accentPetrol : colors.textMuted }]}>Diesel</Text>
                  {alertOnDiesel && <Ionicons name="checkmark-circle" size={16} color={colors.accentPetrol} />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Section title="App Settings" colors={colors}>
            <SettingsRow
              icon="car-sport-outline"
              label="Preferred Fuel"
              subtitle={user?.fuel_type ? t(`register.${user.fuel_type}`) : t('register.petrol')}
              colors={colors}
              onPress={openFuelModal}
            />
            <Divider colors={colors} />
            <SettingsRow
              icon="resize-outline"
              label={t('profile.preferredUnit')}
              subtitle={(() => {
                const unit = user?.preferred_unit || 'L';
                const opt = UNIT_OPTIONS.find(u => u.id === unit);
                return opt ? t(opt.labelKey) : 'Liters (L)';
              })()}
              colors={colors}
              onPress={() => setActiveModal('units')}
            />
            <Divider colors={colors} />
            <SettingsRow
              icon="language-outline"
              label="Language"
              subtitle={currentLang === 'en' ? 'English' : 'Français'}
              colors={colors}
              onPress={() => setActiveModal('lang')}
            />
            <Divider colors={colors} />
            <SettingsRowToggle
              icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'}
              label="Dark Mode"
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              colors={colors}
            />
          </Section>

          <Section title="Support" colors={colors}>
            <SettingsRow
              icon="help-circle-outline"
              label="Help Center"
              colors={colors}
              onPress={() => router.push('/help')}
            />
            <Divider colors={colors} />
            <SettingsRow
              icon="shield-outline"
              label="Privacy Policy"
              colors={colors}
              onPress={() => router.push('/privacy')}
            />
          </Section>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.trendUp} />
          <Text style={[styles.logoutText, { color: colors.trendUp }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={activeModal === 'fuel'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Preferred Fuel</Text>
            {selectableItem(FUEL_TYPES.map(ft => ({ id: ft.id, labelKey: ft.labelKey })), modalFuel, setModalFuel)}
            <TouchableOpacity style={[styles.modalDone, { backgroundColor: colors.accentPetrol }]} onPress={confirmFuel}>
              <Text style={[styles.modalDoneText, { color: '#fff' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={activeModal === 'lang'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Language</Text>
            {selectableItem([
              { id: 'en', labelKey: 'English' as any },
              { id: 'fr', labelKey: 'Français' as any },
            ], currentLang, (id) => handleLangChange(id as 'en' | 'fr'))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={activeModal === 'units'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('profile.preferredUnit')}</Text>
            <View style={{ gap: 2 }}>
              {UNIT_OPTIONS.map((item) => {
                const isSelected = (user?.preferred_unit || 'L') === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modalRow, isSelected && { backgroundColor: colors.bgPrimaryLight }]}
                    onPress={() => handleUnitChange(item.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={item.icon as any} size={20} color={isSelected ? colors.accentPetrol : colors.textMuted} />
                      <Text style={[styles.modalRowText, { color: colors.textPrimary }, isSelected && { color: colors.accentPetrol, fontWeight: '700' }]}>
                        {t(item.labelKey)}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.accentPetrol} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={activeModal === 'password'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('profile.changePassword')}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderBottomColor: colors.border, marginBottom: 12 }]}
              value={cpCurrentPw}
              onChangeText={setCpCurrentPw}
              placeholder={t('profile.currentPassword')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderBottomColor: colors.border, marginBottom: 16 }]}
              value={cpNewPw}
              onChangeText={setCpNewPw}
              placeholder={t('profile.newPassword')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.editActionBtn, { borderColor: colors.border }]}
                onPress={() => setActiveModal(null)}
              >
                <Text style={[styles.editActionCancel, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editActionBtn, { backgroundColor: colors.accentPetrol }]}
                onPress={handleChangePassword}
                disabled={cpSaving}
              >
                {cpSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.editActionSave, { color: '#fff' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, colors, children }: { title: string; colors: any; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ icon, label, subtitle, colors, onPress }: { icon: string; label: string; subtitle?: string; colors: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.settingsIcon, { backgroundColor: colors.bgPrimaryLight || colors.bgSurface }]}>
        <Ionicons name={icon as any} size={20} color={colors.accentPetrol} />
      </View>
      <View style={styles.settingsLabelWrap}>
        <Text style={[styles.settingsLabel, { color: colors.textPrimary }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingsSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function SettingsRowToggle({ icon, label, value, disabled, onValueChange, colors }: { icon: string; label: string; value: boolean; disabled?: boolean; onValueChange: (v: boolean) => void; colors: any }) {
  return (
    <View style={styles.settingsRow}>
      <View style={[styles.settingsIcon, { backgroundColor: colors.bgPrimaryLight || colors.bgSurface }]}>
        <Ionicons name={icon as any} size={20} color={colors.accentPetrol} />
      </View>
      <Text style={[styles.settingsLabel, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.borderInput, true: colors.accentPetrol }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, height: 56,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 24 },
  profileHeader: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  nameText: { fontSize: 22, fontWeight: '700' },
  emailText: { fontSize: 14 },
  editCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  editInput: { fontSize: 16, fontWeight: '600', borderBottomWidth: 1, paddingVertical: 6 },
  editLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editActionBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  editActionCancel: { fontSize: 15, fontWeight: '600' },
  editActionSave: { fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14, gap: 12,
  },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsLabelWrap: { flex: 1 },
  settingsLabel: { fontSize: 15, fontWeight: '500' },
  settingsSubtitle: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginHorizontal: 14 },
  thresholdCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12, marginTop: -12 },
  thresholdRow: { flexDirection: 'row', gap: 8 },
  thresholdChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  thresholdChipText: { fontSize: 13 },
  fuelToggleRow: { flexDirection: 'row', gap: 8 },
  fuelToggleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  fuelToggleLabel: { fontSize: 13, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, borderWidth: 1, marginTop: 4,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 },
  modalRowText: { fontSize: 16 },
  modalDone: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  modalDoneText: { fontSize: 16, fontWeight: '600' },
});
