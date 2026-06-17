import { Stack, useRouter, useSegments } from 'expo-router';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { azureClarityConfig } from '@/theme/azure-clarity';
import { isAuthenticated } from '@/services/auth';
import { registerForPushNotifications } from '@/services/notifications';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!isAuthenticated() && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated() && inAuthGroup) {
      router.replace('/');
    }
    if (isAuthenticated()) {
      registerForPushNotifications();
    }
    setChecked(true);
  }, [segments, checked, router]);

  return checked;
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const authChecked = useProtectedRoute();

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady || !authChecked) {
    return (
      <GluestackUIProvider config={azureClarityConfig}>
        <View style={styles.splash}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>⛽</Text>
            </View>
          </View>
          <Text style={styles.brandName}>AstraFlow</Text>
          <Text style={styles.tagline}>Intelligent Fuel Insights</Text>
          <View style={styles.dots}>
            <Text style={styles.dot}>.</Text>
            <Text style={styles.dot}>.</Text>
            <Text style={styles.dot}>.</Text>
          </View>
          <Text style={styles.footer}>Secure & Efficient</Text>
        </View>
        <StatusBar style="light" />
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
      <StatusBar style="dark" />
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#f9f9fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: '#003087',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 40,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#003087',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#444652',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  dot: {
    fontSize: 24,
    color: '#003087',
    opacity: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontSize: 12,
    fontWeight: '600',
    color: '#747683',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
