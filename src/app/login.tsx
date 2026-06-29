import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';
import { api } from '@/services/api';
import { setToken, setUser } from '@/services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const colors = useAppColor();
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', t('login.enterEmail'));
      return;
    }
    if (!password) {
      Alert.alert('Error', t('login.enterPassword'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.login({ email: email.trim(), password });
      await Promise.all([setToken(res.token), setUser(res.user)]);
      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('login.loginFailed'), err.detail || err.message || t('login.unableToSignIn'));
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
              {t('login.tagline')}
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.bgCard, borderColor: colors.borderInput }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('login.emailLabel')}</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('login.passwordLabel')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { borderColor: colors.borderInput, color: colors.textPrimary, backgroundColor: colors.bgCard }]}
                  placeholder={t('login.passwordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled, { backgroundColor: colors.accentPetrol }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Text style={[styles.buttonText, { color: colors.textWhite }]}>{t('login.signIn')}</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.textWhite} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerSection}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t('login.noAccount')}{' '}
              <Text style={[styles.linkText, { color: colors.accentPetrol }]} onPress={() => router.push('/register')}>
                {t('login.createOne')}
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
  },
  tagline: {
    fontSize: 14,
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
  footerSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
