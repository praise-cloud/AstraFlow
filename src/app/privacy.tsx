import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppColor } from '@/hooks/useAppColor';

const SECTIONS = [
  {
    title: 'Information We Collect',
    content: 'We collect information you provide when creating an account, including your name, email address, business type, and fuel preferences. We also collect usage data to improve our prediction algorithms and personalize your experience.',
  },
  {
    title: 'How We Use Your Data',
    content: 'Your data is used to provide fuel price predictions, send price alerts, personalize your dashboard, and improve our services. We do not sell your personal information to third parties.',
  },
  {
    title: 'Data Storage & Security',
    content: 'All data is encrypted in transit using TLS and at rest using AES-256 encryption. We implement industry-standard security measures to protect your information from unauthorized access.',
  },
  {
    title: 'Data Retention',
    content: 'We retain your account data for as long as your account is active. You can request deletion of your account and associated data at any time by contacting our support team.',
  },
  {
    title: 'Third-Party Services',
    content: 'We use trusted third-party services for cloud hosting, push notifications, and analytics. These providers are contractually bound to protect your data and use it only for the purposes we specify.',
  },
  {
    title: 'Your Rights',
    content: 'You have the right to access, correct, or delete your personal data. You can manage your preferences in the app settings or contact us to exercise these rights.',
  },
  {
    title: 'Updates to This Policy',
    content: 'We may update this privacy policy from time to time. We will notify you of any material changes through the app or via email.',
  },
];

export default function PrivacyScreen() {
  const colors = useAppColor();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>Last updated: June 2026</Text>

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {SECTIONS.map((s, i) => (
            <View key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>{s.content}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          If you have questions about this policy, contact us at support@astraflow.mu
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, height: 56,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 16, gap: 20, paddingTop: 8, paddingBottom: 40 },
  lastUpdated: { fontSize: 12, paddingHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: 14 },
  section: { paddingVertical: 14, paddingHorizontal: 14, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionContent: { fontSize: 13, lineHeight: 20 },
  footer: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 4 },
});
