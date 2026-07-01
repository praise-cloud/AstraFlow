import { Stack, useRouter, useSegments } from 'expo-router';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
  BounceIn,
  SlideInUp,
  ZoomIn,
} from 'react-native-reanimated';

import { azureClarityConfig } from '@/theme/azure-clarity';
import { isAuthenticated, restoreAuth } from '@/services/auth';
import { registerForPushNotifications } from '@/services/notifications';
import { isOnboardingCompleted } from '@/services/onboarding';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useAppColor } from '@/hooks/useAppColor';
import { readyPromise as i18nReady } from '@/i18n';
import { PulsingDot } from '@/components/animations/PulsingDot';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    const check = async () => {
      await restoreAuth();
      const authenticated = await Promise.resolve(isAuthenticated());
      const onboardingDone = await isOnboardingCompleted();
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'welcome';
      const inOnboarding = segments[0] === 'onboarding';

      if (!authenticated && !inAuthGroup && !inOnboarding && !onboardingDone) {
        router.replace('/onboarding');
      } else if (!authenticated && !inAuthGroup && onboardingDone) {
        router.replace('/welcome');
      } else if (authenticated && (inAuthGroup || inOnboarding)) {
        router.replace('/');
      }
      if (authenticated) {
        registerForPushNotifications();
      }
      setChecked(true);
    };
    check();
  }, [segments, checked, router]);

  return checked;
}

function RootLayoutInner() {
  const [isReady, setIsReady] = useState(false);
  const [i18nLoaded, setI18nLoaded] = useState(false);
  const authChecked = useProtectedRoute();
  const { theme } = useTheme();
  const colors = useAppColor();
  const { t } = useTranslation();

  useEffect(() => {
    i18nReady.then(() => setI18nLoaded(true));
  }, []);

  useEffect(() => {
    if (!i18nLoaded) return;
    const timer = setTimeout(() => setIsReady(true), 1500);
    return () => clearTimeout(timer);
  }, [i18nLoaded]);

  if (!isReady || !authChecked) {
    return (
      <GluestackUIProvider config={azureClarityConfig}>
        <View style={[styles.splashContainer, { backgroundColor: colors.bg }]}>
          <Animated.View entering={BounceIn.duration(800).springify()}>
            <View style={[styles.logo, { backgroundColor: colors.bgPrimary }]}>
              <MaterialCommunityIcons name="gas-station" size={80} color={colors.accentPetrol} />
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.duration(600).delay(400)}
            style={[styles.brandName, { color: colors.accentPetrol }]}
          >
            {t('splash.title')}
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.duration(500).delay(700)}
            style={[styles.tagline, { color: colors.textSecondary }]}
          >
            {t('splash.subtitle')}
          </Animated.Text>

          <View style={styles.dots}>
            <PulsingDot size={8} color={colors.accentPetrol} delay={900} />
            <PulsingDot size={8} color={colors.accentPetrol} delay={1100} />
            <PulsingDot size={8} color={colors.accentPetrol} delay={1300} />
          </View>

          <Animated.Text
            entering={FadeIn.duration(400).delay(1200)}
            style={[styles.footer, { color: colors.textMuted }]}
          >
            {t('splash.footer')}
          </Animated.Text>
        </View>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </GluestackUIProvider>
    );
  }

  return (
    <GluestackUIProvider config={azureClarityConfig}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="survey" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </GluestackUIProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  dot: {
    fontSize: 24,
    opacity: 0.3,
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
