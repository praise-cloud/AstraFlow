import { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useAppColor } from '@/hooks/useAppColor';

interface AnimatedBarProps {
  percentage: number;
  height?: number;
  borderRadius?: number;
  color?: string;
  trackColor?: string;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export function AnimatedBar({
  percentage,
  height = 6,
  borderRadius = 3,
  color,
  trackColor,
  duration = 600,
  style,
  animated = true,
}: AnimatedBarProps) {
  const colors = useAppColor();
  const width = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      width.value = withTiming(percentage, { duration });
    } else {
      width.value = percentage;
    }
  }, [percentage, animated, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, width.value))}%` as any,
  }));

  return (
    <View
      style={[
        {
          height,
          borderRadius,
            backgroundColor: trackColor ?? colors.barTrack as string,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius,
              backgroundColor: color || colors.accentPetrol as string,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}
