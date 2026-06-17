import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { api } from '@/services/api';

const CONCERN_AREAS = [
  { id: 'transport', label: 'Transport Costs' },
  { id: 'supply_chain', label: 'Supply Chain' },
  { id: 'operations', label: 'Operations' },
  { id: 'profit_margins', label: 'Profit Margins' },
];

const IMPACT_LEVELS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'severe', label: 'Severe' },
];

export default function SurveyScreen() {
  const [step, setStep] = useState(0);
  const [monthlySpend, setMonthlySpend] = useState('');
  const [impactLevel, setImpactLevel] = useState('');
  const [concernAreas, setConcernAreas] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleConcern = (id: string) => {
    setConcernAreas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.surveys.submit({
        monthly_fuel_spend: monthlySpend ? parseFloat(monthlySpend) : undefined,
        impact_level: impactLevel || undefined,
        concern_areas: concernAreas.length > 0 ? concernAreas : undefined,
        comments: comments || undefined,
      });
      Alert.alert('Thank you!', 'Your response helps improve AstraFlow insights.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      Alert.alert('Error', err.detail || 'Failed to submit survey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fuel Impact Survey</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{step + 1} / 4</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {step === 0 && (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Monthly Fuel Spend</Text>
            <Text style={styles.stepSubtitle}>How much does your business spend on fuel per month?</Text>
            <View style={styles.spendRow}>
              <Text style={styles.currencySign}>Rs</Text>
              <TextInput
                style={styles.spendInput}
                placeholder="0"
                placeholderTextColor="#c4c6d4"
                value={monthlySpend}
                onChangeText={setMonthlySpend}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Impact Level</Text>
            <Text style={styles.stepSubtitle}>How severely have fuel prices affected your business?</Text>
            <View style={styles.impactGrid}>
              {IMPACT_LEVELS.map(level => (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.impactChip, impactLevel === level.id && styles.impactChipSelected]}
                  onPress={() => setImpactLevel(level.id)}
                >
                  <Text style={[styles.impactText, impactLevel === level.id && styles.impactTextSelected]}>
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Areas of Concern</Text>
            <Text style={styles.stepSubtitle}>Which areas are most affected? (select all that apply)</Text>
            <View style={styles.concernGrid}>
              {CONCERN_AREAS.map(area => (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.concernChip, concernAreas.includes(area.id) && styles.concernChipSelected]}
                  onPress={() => toggleConcern(area.id)}
                >
                  <Text style={[styles.concernText, concernAreas.includes(area.id) && styles.concernTextSelected]}>
                    {area.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>Additional Comments</Text>
            <Text style={styles.stepSubtitle}>Anything else you'd like to share about fuel price impact?</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Your feedback helps us provide better insights..."
              placeholderTextColor="#747683"
              value={comments}
              onChangeText={setComments}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Submit Survey</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < 3 && (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9fc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
  },
  backIcon: { fontSize: 24, color: '#003087' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1c1e' },
  stepIndicator: { backgroundColor: '#dbe1ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  stepText: { fontSize: 12, fontWeight: '600', color: '#003087' },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, gap: 24 },
  step: { gap: 16 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#003087' },
  stepSubtitle: { fontSize: 14, color: '#747683', lineHeight: 20 },
  spendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#c4c6d4',
    paddingHorizontal: 16, height: 56,
  },
  currencySign: { fontSize: 18, fontWeight: '600', color: '#1a1c1e' },
  spendInput: { flex: 1, fontSize: 18, color: '#1a1c1e', height: '100%' },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  impactChip: {
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#c4c6d4', backgroundColor: '#ffffff',
  },
  impactChipSelected: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  impactText: { fontSize: 16, fontWeight: '500', color: '#444652' },
  impactTextSelected: { color: '#003087', fontWeight: '600' },
  concernGrid: { gap: 8 },
  concernChip: {
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#c4c6d4', backgroundColor: '#ffffff',
  },
  concernChipSelected: { borderColor: '#003087', backgroundColor: '#dbe1ff' },
  concernText: { fontSize: 15, fontWeight: '500', color: '#444652' },
  concernTextSelected: { color: '#003087', fontWeight: '600' },
  commentInput: {
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#c4c6d4',
    padding: 16, fontSize: 14, color: '#1a1c1e', minHeight: 120,
  },
  submitButton: {
    height: 52, backgroundColor: '#003087', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 16,
    borderTopWidth: 1, borderTopColor: '#eeeef0',
  },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { fontSize: 16, fontWeight: '600', color: '#747683' },
  nextBtn: {
    backgroundColor: '#003087', paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 8,
  },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
