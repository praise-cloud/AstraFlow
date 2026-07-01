import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAppColor } from '@/hooks/useAppColor';

type GlowVariant = 'primary' | 'success' | 'warning' | 'danger';

interface GlowEffectProps {
  children: ReactNode;
  variant?: GlowVariant;
  size?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS = {
  primary: 'accentPetrol' as const,
  success: 'trendDown' as const,
  warning: 'riskModerate' as const,
  danger: 'riskHigh' as const,
};

export function GlowEffect({
  children,
  variant = 'primary',
  size = 3,
  duration = 2000,
  delay = 0,
  style,
}: GlowEffectProps) {
  const colors = useAppColor();
  const colorKey = VARIANT_COLORS[variant];
  const accentColor = colors[colorKey] as string;
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.8, {
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowColor: accentColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity.value,
    shadowRadius: size * 2,
    elevation: size * 2,
    borderColor: accentColor,
    borderWidth: 0,
  }));

  return (
    <Animated.View style={[animatedStyle, { borderRadius: 12 }, style]}>
      {children}
    </Animated.View>
  );
}
