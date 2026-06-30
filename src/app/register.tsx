import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { setToken, setUser } from '@/services/auth';
import { useAppColor } from '@/hooks/useAppColor';

const FUEL_TYPES = [
  { id: 'petrol', icon: 'car-sport-outline' },
  { id: 'diesel', icon: 'car-outline' },
  { id: 'both', icon: 'swap-horizontal-outline' },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [businessType, setBusinessType] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [loading, setLoading] = useState(false);

  const colors = useAppColor();
  const { t } = useTranslation();

  const BUSINESS_TYPES = [
    { id: 'restaurant', label: t('register.businessRestaurant'), icon: 'restaurant-outline' },
    { id: 'taxi', label: t('register.businessTaxi'), icon: 'car-outline' },
    { id: 'delivery', label: t('register.businessDelivery'), icon: 'cube-outline' },
    { id: 'retail', label: t('register.businessRetail'), icon: 'storefront-outline' },
    { id: 'logistics', label: t('register.businessLogistics'), icon: 'bus-outline' },
  ];

  const handleRegister = async () => {
    if (!fullName || !email || !password || !businessType || !fuelType) {
      Alert.alert('Error', t('register.fillAllFields'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.register({
        email,
        password,
        full_name: fullName,
        business_type: businessType,
        fuel_type: fuelType,
      });
      await Promise.all([setToken(res.token), setUser(res.user)]);
      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('register.registrationFailed'), err.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandSection}>
            <View style={[styles.logo, { backgroundColor: colors.accentPetrol }]}>
              <MaterialCommunityIcons name="gas-station-outline" size={48} color={colors.textWhite} />
            </View>
            <Text style={[styles.brandName, { color: colors.accentPetrol }]}>{t('common.appName')}</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              {t('register.tagline')}
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.bgCard, borderColor: colors.borderInput }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('register.fullNameLabel')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                placeholder={t('register.fullNamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('register.emailLabel')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                placeholder={t('register.emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('register.passwordLabel')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                  placeholder={t('register.passwordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('register.fuelTypeLabel')}</Text>
              <View style={styles.businessGrid}>
                {FUEL_TYPES.map((ft) => (
                  <TouchableOpacity
                    key={ft.id}
                    style={[
                      styles.businessChip,
                      { borderColor: fuelType === ft.id ? colors.accentPetrol : colors.borderInput, backgroundColor: fuelType === ft.id ? colors.bgPrimaryLight : colors.bgSurface },
                    ]}
                    onPress={() => setFuelType(ft.id)}
                  >
                    <Ionicons name={ft.icon as any} size={24} color={fuelType === ft.id ? colors.accentPetrol : colors.textMuted} />
                    <Text
                      style={[
                        styles.businessLabel,
                        fuelType === ft.id && styles.businessLabelSelected,
                        { color: fuelType === ft.id ? colors.accentPetrol : colors.textSecondary },
                      ]}
                    >
                      {t(`register.${ft.id}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('register.businessTypeLabel')}</Text>
              <View style={styles.businessGrid}>
                {BUSINESS_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt.id}
                    style={[
                      styles.businessChip,
                      { borderColor: businessType === bt.id ? colors.accentPetrol : colors.borderInput, backgroundColor: businessType === bt.id ? colors.bgPrimaryLight : colors.bgSurface },
                    ]}
                    onPress={() => setBusinessType(bt.id)}
                  >
                    <Ionicons name={bt.icon as any} size={24} color={businessType === bt.id ? colors.accentPetrol : colors.textMuted} />
                    <Text
                      style={[
                        styles.businessLabel,
                        businessType === bt.id && styles.businessLabelSelected,
                        { color: businessType === bt.id ? colors.accentPetrol : colors.textSecondary },
                      ]}
                    >
                      {bt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.accentPetrol }, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Text style={[styles.buttonText, { color: colors.textWhite }]}>{t('register.createAccount')}</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textWhite} />
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.termsText, { color: colors.textMuted }]}>
              {t('register.termsPrefix')}{' '}
              <Text style={[styles.linkInline, { color: colors.accentPetrol }]}>{t('register.termsOfService')}</Text> and{' '}
              <Text style={[styles.linkInline, { color: colors.accentPetrol }]}>{t('register.privacyPolicy')}</Text>.
            </Text>
          </View>

          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t('register.hasAccount')}{' '}
              <Text style={[styles.linkText, { color: colors.accentPetrol }]} onPress={() => router.back()}>
                {t('register.logIn')}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'WorkSans',
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  formCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 14,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  businessLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  businessLabelSelected: {
    fontWeight: '600',
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkInline: {
    fontWeight: '600',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter',
  },
  linkText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
