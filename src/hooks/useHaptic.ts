import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function useHaptic() {
  const hapticLight = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const hapticMedium = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const hapticHeavy = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const hapticSuccess = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const hapticError = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, []);

  const hapticWarning = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  return { hapticLight, hapticMedium, hapticHeavy, hapticSuccess, hapticError, hapticWarning };
}
