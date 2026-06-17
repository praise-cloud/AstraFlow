import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
import { setToken, setUser } from '@/services/auth';

const BUSINESS_TYPES = [
  { id: 'restaurant', label: 'Restaurant', icon: '🍽️' },
  { id: 'taxi', label: 'Taxi Driver', icon: '🚕' },
  { id: 'delivery', label: 'Delivery Business', icon: '📦' },
  { id: 'retail', label: 'Retail Shop', icon: '🏪' },
  { id: 'logistics', label: 'Logistics Company', icon: '🚛' },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [businessType, setBusinessType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !businessType) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.register({
        email,
        password,
        full_name: fullName,
        business_type: businessType,
      });
      setToken(res.token);
      setUser(res.user);
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandSection}>
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>⛽</Text>
            </View>
            <Text style={styles.brandName}>AstraFlow</Text>
            <Text style={styles.tagline}>
              Create your account to start predicting energy flows and price shifts.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#747683"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor="#747683"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#747683"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>BUSINESS TYPE</Text>
              <View style={styles.businessGrid}>
                {BUSINESS_TYPES.map((bt) => (
                  <TouchableOpacity
                    key={bt.id}
                    style={[
                      styles.businessChip,
                      businessType === bt.id && styles.businessChipSelected,
                    ]}
                    onPress={() => setBusinessType(bt.id)}
                  >
                    <Text style={styles.businessIcon}>{bt.icon}</Text>
                    <Text
                      style={[
                        styles.businessLabel,
                        businessType === bt.id && styles.businessLabelSelected,
                      ]}
                    >
                      {bt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Create Account</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text style={styles.linkInline}>Terms of Service</Text> and{' '}
              <Text style={styles.linkInline}>Privacy Policy</Text>.
            </Text>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text style={styles.linkText} onPress={() => router.back()}>
                Log in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9fc',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    backgroundColor: '#003087',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 28,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#003087',
    fontFamily: 'WorkSans',
  },
  tagline: {
    fontSize: 14,
    color: '#444652',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c4c6d4',
    padding: 24,
    gap: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444652',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#c4c6d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1a1c1e',
    backgroundColor: '#ffffff',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#c4c6d4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 48,
    fontSize: 14,
    color: '#1a1c1e',
    backgroundColor: '#ffffff',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  businessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c4c6d4',
    backgroundColor: '#f9f9fc',
  },
  businessChipSelected: {
    borderColor: '#003087',
    backgroundColor: '#dbe1ff',
  },
  businessIcon: {
    fontSize: 16,
  },
  businessLabel: {
    fontSize: 13,
    color: '#444652',
    fontWeight: '500',
  },
  businessLabelSelected: {
    color: '#003087',
    fontWeight: '600',
  },
  primaryButton: {
    height: 48,
    backgroundColor: '#003087',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonArrow: {
    fontSize: 18,
    color: '#ffffff',
  },
  termsText: {
    fontSize: 12,
    color: '#747683',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkInline: {
    color: '#003087',
    fontWeight: '600',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#444652',
    fontFamily: 'Inter',
  },
  linkText: {
    color: '#003087',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
