import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppColor } from '@/hooks/useAppColor';
import { completeOnboarding } from '@/services/onboarding';

export default function WelcomeScreen() {
  const colors = useAppColor();
  const { t } = useTranslation();

  const handleNewHere = async () => {
    await completeOnboarding();
    router.replace('/register');
  };

  const handleWelcomeBack = async () => {
    await completeOnboarding();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.logoContainer, { backgroundColor: colors.bgPrimary }]}>
          <MaterialCommunityIcons name="gas-station" size={64} color={colors.textWhite} />
        </View>
        <Text style={[styles.brandName, { color: colors.accentPetrol }]}>{t('common.appName')}</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t('common.tagline')}</Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accentPetrol }]}
          onPress={handleNewHere}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.textWhite} />
          <Text style={[styles.primaryBtnText, { color: colors.textWhite }]}>{t('welcome.newHere')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.accentPetrol }]}
          onPress={handleWelcomeBack}
          activeOpacity={0.8}
        >
          <Ionicons name="log-in-outline" size={18} color={colors.accentPetrol} />
          <Text style={[styles.secondaryBtnText, { color: colors.accentPetrol }]}>{t('welcome.welcomeBack')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.footer, { color: colors.textMuted }]}>{t('splash.footer')}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
  divider: {
    width: 60,
    height: 1,
    marginVertical: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 320,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 320,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
