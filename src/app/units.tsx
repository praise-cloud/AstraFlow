import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppColor } from '@/hooks/useAppColor';

const UNIT_OPTIONS = [
  { id: 'liters', label: 'Liters', symbol: 'L', desc: 'Standard metric unit for fuel volume' },
  { id: 'gallons', label: 'Gallons', symbol: 'gal', desc: 'Imperial gallon (UK)' },
];

export default function UnitsScreen() {
  const colors = useAppColor();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Units</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scrollContent}>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>Choose your preferred unit for fuel measurements.</Text>

        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {UNIT_OPTIONS.map((u, i) => (
            <View key={u.id}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>{u.label}</Text>
                  <Text style={[styles.descSm, { color: colors.textSecondary }]}>{u.desc}</Text>
                </View>
                <Text style={[styles.symbol, { color: colors.accentPetrol }]}>{u.symbol}</Text>
              </View>
            </View>
          ))}
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
  desc: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  label: { fontSize: 15, fontWeight: '600' },
  descSm: { fontSize: 12, marginTop: 2 },
  symbol: { fontSize: 16, fontWeight: '700' },
});
