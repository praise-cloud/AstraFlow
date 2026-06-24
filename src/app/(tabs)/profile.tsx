import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { getUserAsync, clearToken } from '@/services/auth';
import { api } from '@/services/api';
import { registerForPushNotifications, unregisterPushNotifications } from '@/services/notifications';

const BUSINESS_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  taxi: 'Taxi Driver',
  delivery: 'Delivery Business',
  retail: 'Retail Shop',
  logistics: 'Logistics Company',
};

export default function ProfileScreen() {
  const [user, setUser] = useState<{ id: string; email: string; full_name: string; business_type: string } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    getUserAsync().then(setUser);
    api.notifications.preferences().then(prefs => setPushEnabled(prefs.push_enabled)).catch(() => {});
  }, []);

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
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⛽</Text>
          <Text style={styles.headerTitle}>AstraFlow</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.full_name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {user?.business_type && (
            <View style={styles.businessTag}>
              <Text style={styles.businessTagText}>
                {BUSINESS_LABELS[user.business_type] || user.business_type}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Account Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user?.full_name || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Type</Text>
            <Text style={styles.infoValue}>
              {user?.business_type ? BUSINESS_LABELS[user.business_type] : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.notifCard}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>Notifications</Text>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              disabled={toggling}
              trackColor={{ false: '#c4c6d4', true: '#003087' }}
              thumbColor="#ffffff"
            />
          </View>
          <Text style={styles.notifText}>
            {pushEnabled
              ? 'Price alerts are enabled — you will be notified of significant changes'
              : 'Enable price alerts to stay informed about fuel price changes'}
          </Text>
        </View>

        <TouchableOpacity style={styles.surveyCard} onPress={() => router.push('/survey')}>
          <View style={styles.surveyIconRow}>
            <Text style={styles.surveyIcon}>📋</Text>
            <Text style={styles.surveyBadge}>2 min</Text>
          </View>
          <Text style={styles.surveyTitle}>Fuel Impact Survey</Text>
          <Text style={styles.surveyText}>
            Tell us how fuel prices affect your business
          </Text>
        </TouchableOpacity>

        <View style={styles.appInfoCard}>
          <Text style={styles.appInfoTitle}>AstraFlow</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
          <Text style={styles.appInfoDesc}>
            AI-Based Fuel Price Forecasting and Evaluation System for Mauritius
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9fc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#f9f9fc',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003087',
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
    backgroundColor: '#003087',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1e',
  },
  email: {
    fontSize: 14,
    color: '#747683',
  },
  businessTag: {
    backgroundColor: '#dbe1ff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  businessTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003087',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee5ef',
    padding: 24,
    gap: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444652',
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
    color: '#747683',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1c1e',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f3f6',
  },
  appInfoCard: {
    backgroundColor: '#f0f4fa',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  appInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003087',
  },
  appInfoVersion: {
    fontSize: 12,
    color: '#747683',
  },
  appInfoDesc: {
    fontSize: 12,
    color: '#444652',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  notifCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dee5ef',
    padding: 20, gap: 8,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifTitle: { fontSize: 15, fontWeight: '600', color: '#1a1c1e' },
  notifText: { fontSize: 13, color: '#747683', lineHeight: 18 },
  surveyCard: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#003087',
    padding: 20, gap: 8, borderLeftWidth: 4,
  },
  surveyIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surveyIcon: { fontSize: 20 },
  surveyBadge: {
    fontSize: 10, fontWeight: '600', color: '#003087', backgroundColor: '#dbe1ff',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, textTransform: 'uppercase',
  },
  surveyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1c1e' },
  surveyText: { fontSize: 14, color: '#444652', lineHeight: 20 },
  logoutButton: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ba1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ba1a1a',
  },
});
