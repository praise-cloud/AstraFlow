import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppColor } from '@/hooks/useAppColor';
import { useTheme } from '@/context/ThemeContext';
import { clearToken } from '@/services/auth';

type RowItem = {
  icon: string; label: string; onPress?: () => void;
  right?: string; value?: boolean; onToggle?: () => void; danger?: boolean;
};

interface SectionGroup { section: string; items: RowItem[]; }

export default function SettingsScreen() {
  const colors = useAppColor();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

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

  const rows: SectionGroup[] = [
    { section: 'Notifications', items: [
      { icon: 'notifications-outline', label: 'Price Alerts', onPress: () => router.push('/profile') },
    ]},
    { section: 'Preferences', items: [
      { icon: theme === 'dark' ? 'moon-outline' : 'sunny-outline', label: 'Dark Mode', right: 'toggle', value: theme === 'dark', onToggle: toggleTheme },
      { icon: 'language-outline', label: 'Language', onPress: () => router.push('/profile') },
    ]},
    { section: 'Support', items: [
      { icon: 'help-circle-outline', label: 'Help Center', onPress: () => router.push('/help') },
      { icon: 'shield-outline', label: 'Privacy Policy', onPress: () => router.push('/privacy') },
      { icon: 'document-text-outline', label: 'Terms of Service', onPress: () => {} },
    ]},
    { section: 'Account', items: [
      { icon: 'log-out-outline', label: 'Logout', onPress: handleLogout, danger: true },
    ]},
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {rows.map((section, si) => (
          <View key={si} style={{ gap: 8, marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.section}</Text>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {section.items.map((item, ii) => (
                <View key={ii}>
                  {ii > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <TouchableOpacity style={styles.row} onPress={item.onPress} activeOpacity={0.6} disabled={item.right === 'toggle'}>
                    <Ionicons name={item.icon as any} size={20} color={item.danger ? colors.trendUp : colors.accentPetrol} />
                    <Text style={[styles.rowLabel, { color: item.danger ? colors.trendUp : colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    {item.right === 'toggle' ? (
                      <Switch value={item.value} onValueChange={item.onToggle} trackColor={{ false: colors.borderInput, true: colors.accentPetrol }} thumbColor="#fff" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}
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
  scrollContent: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
});
