const ONBOARDING_KEY = 'astraflow_onboarding_completed';

function isWeb(): boolean {
  try {
    return require('react-native').Platform.OS === 'web';
  } catch {
    return typeof window !== 'undefined';
  }
}

export async function isOnboardingCompleted(): Promise<boolean> {
  if (isWeb()) {
    try {
      return window.localStorage.getItem(ONBOARDING_KEY) === 'true';
    } catch {
      return false;
    }
  }
  try {
    const SecureStore = require('expo-secure-store');
    const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function completeOnboarding(): Promise<void> {
  if (isWeb()) {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    return;
  }
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
  } catch {}
}
