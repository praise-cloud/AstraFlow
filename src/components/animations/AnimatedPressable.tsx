import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useCallback, ReactNode } from 'react';
import { useHaptic } from '@/hooks/useHaptic';
import { useSound } from '@/hooks/useSound';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';
type SoundType = 'tap' | 'success' | 'error' | 'whoosh' | 'refresh';

interface AnimatedPressableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  scaleTo?: number;
  springConfig?: object;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticType | false;
  sound?: SoundType | false;
}

const HAPTIC_MAP: Record<string, (h: ReturnType<typeof useHaptic>) => () => void> = {
  light: (h) => h.hapticLight,
  medium: (h) => h.hapticMedium,
  heavy: (h) => h.hapticHeavy,
  success: (h) => h.hapticSuccess,
  error: (h) => h.hapticError,
  warning: (h) => h.hapticWarning,
};

const SOUND_MAP: Record<string, (s: ReturnType<typeof useSound>) => () => Promise<void>> = {
  tap: (s) => s.playTap,
  success: (s) => s.playSuccess,
  error: (s) => s.playError,
  whoosh: (s) => s.playWhoosh,
  refresh: (s) => s.playRefresh,
};

export function AnimatedPressable({
  children,
  onPress,
  onPressIn,
  onPressOut,
  style,
  scaleTo = 0.96,
  springConfig = { damping: 15, stiffness: 200 },
  haptic = false,
  sound = false,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const haptics = useHaptic();
  const sounds = useSound();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      scale.value = withSpring(scaleTo, springConfig);
      if (haptic && HAPTIC_MAP[haptic]) {
        HAPTIC_MAP[haptic](haptics)();
      }
      if (sound && SOUND_MAP[sound]) {
        SOUND_MAP[sound](sounds)();
      }
      onPressIn?.(e);
    },
    [scaleTo, springConfig, haptic, sound, haptics, sounds, onPressIn]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, springConfig);
      onPressOut?.(e);
    },
    [springConfig, onPressOut]
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      <Animated.View style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
