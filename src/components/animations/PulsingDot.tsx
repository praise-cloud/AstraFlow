import { useEffect } from 'react';
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

interface PulsingDotProps {
  size?: number;
  color?: string;
  delay?: number;
  minOpacity?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function PulsingDot({
  size = 8,
  color,
  delay = 0,
  minOpacity = 0.2,
  duration = 800,
  style,
}: PulsingDotProps) {
  const colors = useAppColor();
  const dotColor = color || colors.accentPetrol as string;
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(minOpacity, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.6, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [delay, minOpacity, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dotColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
