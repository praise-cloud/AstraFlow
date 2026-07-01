import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';

const FAQS = [
  { q: 'How does the fuel price prediction work?', a: 'Our AI model analyzes historical price data, global crude trends, and local market conditions to forecast fuel price changes up to 7 days ahead.' },
  { q: 'How accurate are the predictions?', a: 'Predictions typically achieve 85-92% accuracy for 24-hour forecasts and 70-80% for 7-day outlooks. Accuracy varies with market volatility.' },
  { q: 'How do I change my fuel type preference?', a: 'Go to Profile > App Settings > Preferred Fuel to select Petrol, Diesel, or Both.' },
  { q: 'How do I set up price alerts?', a: 'Go to Profile > Notifications and enable Price Alert. Set your change threshold and choose which fuel types to monitor.' },
  { q: 'Is my data secure?', a: 'Yes, all data is encrypted in transit and at rest. We never share your personal information with third parties.' },
];

export default function HelpScreen() {
  const colors = useAppColor();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Help Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Frequently Asked Questions</Text>

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {FAQS.map((faq, i) => (
            <View key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.faqItem}>
                <Text style={[styles.question, { color: colors.textPrimary }]}>{faq.q}</Text>
                <Text style={[styles.answer, { color: colors.textSecondary }]}>{faq.a}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.contactCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={20} color={colors.accentPetrol} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>Still need help?</Text>
            <Text style={[styles.contactSub, { color: colors.textSecondary }]}>Reach out to our support team</Text>
          </View>
          <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.accentPetrol }]} onPress={() => Linking.openURL('mailto:support@astraflow.mu')}>
            <Text style={[styles.contactBtnText, { color: '#fff' }]}>Contact</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  scrollContent: { padding: 16, gap: 20, paddingTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: 14 },
  faqItem: { paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  question: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  answer: { fontSize: 13, lineHeight: 18 },
  contactCard: {
    borderRadius: 14, borderWidth: 1, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  contactTitle: { fontSize: 14, fontWeight: '600' },
  contactSub: { fontSize: 12, marginTop: 1 },
  contactBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  contactBtnText: { fontSize: 13, fontWeight: '600' },
});
