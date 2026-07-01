import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { useAppColor } from '@/hooks/useAppColor';
import { useToast } from '@/context/ToastContext';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const colors = useAppColor();
  const { showToast } = useToast();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!currentPw) { showToast({ type: 'warning', title: 'Validation', message: 'Current password is required' }); return; }
    if (!newPw) { showToast({ type: 'warning', title: 'Validation', message: 'New password is required' }); return; }
    if (newPw.length < 6) { showToast({ type: 'warning', title: 'Validation', message: 'New password must be at least 6 characters' }); return; }
    if (newPw !== confirmPw) { showToast({ type: 'warning', title: 'Validation', message: 'Passwords do not match' }); return; }
    setSaving(true);
    try {
      await api.profile.changePassword({ current_password: currentPw, new_password: newPw });
      showToast({ type: 'success', title: 'Success', message: 'Password changed successfully' });
      router.back();
    } catch (err: any) {
      showToast({ type: 'error', title: 'Error', message: err.detail || 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { label: 'Current Password', value: currentPw, setter: setCurrentPw, show: showCurrent, toggle: () => setShowCurrent(!showCurrent), placeholder: 'Enter current password' },
    { label: 'New Password', value: newPw, setter: setNewPw, show: showNew, toggle: () => setShowNew(!showNew), placeholder: 'Enter new password' },
    { label: 'Confirm Password', value: confirmPw, setter: setConfirmPw, show: showConfirm, toggle: () => setShowConfirm(!showConfirm), placeholder: 'Re-enter new password' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.headerRow]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPetrol} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.scrollContent}>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            Your password must be at least 6 characters long.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {rows.map((r, i) => (
              <View key={i}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{r.label}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary }]}
                      value={r.value}
                      onChangeText={r.setter}
                      placeholder={r.placeholder}
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!r.show}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={r.toggle} style={styles.eyeBtn}>
                      <Ionicons name={r.show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accentPetrol }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.saveBtnText]}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  row: { paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 4 },
  eyeBtn: { padding: 4 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
