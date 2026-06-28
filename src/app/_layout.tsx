import { Stack, useRouter, useSegments } from 'expo-router';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { azureClarityConfig } from '@/theme/azure-clarity';
import { isAuthenticated } from '@/services/auth';
import { registerForPushNotifications } from '@/services/notifications';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useAppColor } from '@/hooks/useAppColor';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    const check = async () => {
      const authenticated = await Promise.resolve(isAuthenticated());
      const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

      if (!authenticated && !inAuthGroup) {
        router.replace('/login');
      } else if (authenticated && inAuthGroup) {
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
  const authChecked = useProtectedRoute();
  const { theme } = useTheme();
  const colors = useAppColor();

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady || !authChecked) {
    return (
      <GluestackUIProvider config={azureClarityConfig}>
        <View style={[styles.splashContainer, { backgroundColor: colors.bg }]}>
          <View style={styles.logoContainer}>
            <View style={[styles.logo, { backgroundColor: colors.bgPrimary }]}>
              <MaterialCommunityIcons name="gas-station" size={80} color={colors.accentPetrol} />
            </View>
          </View>
          <Text style={[styles.brandName, { color: colors.accentPetrol }]}>AstraFlow</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Intelligent Fuel Insights</Text>
          <View style={styles.dots}>
            <Text style={[styles.dot, { color: colors.accentPetrol }]}>.</Text>
            <Text style={[styles.dot, { color: colors.accentPetrol }]}>.</Text>
            <Text style={[styles.dot, { color: colors.accentPetrol }]}>.</Text>
          </View>
          <Text style={[styles.footer, { color: colors.textMuted }]}>Secure & Efficient</Text>
        </View>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </GluestackUIProvider>
    );
  }

  return (
    <GluestackUIProvider config={azureClarityConfig}>
      <Stack screenOptions={{ headerShown: false }}>
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
