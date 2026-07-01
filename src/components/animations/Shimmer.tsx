import { useEffect } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useAppColor } from '@/hooks/useAppColor';

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  baseColor?: string;
  shimmerColor?: string;
  delay?: number;
}

export function Shimmer({
  width,
  height,
  borderRadius = 6,
  style,
  baseColor,
  shimmerColor,
  delay = 0,
}: ShimmerProps) {
  const colors = useAppColor();
  const translateX = useSharedValue(-200);

  useEffect(() => {
    translateX.value = withDelay(
      delay,
      withRepeat(
        withTiming(400, { duration: 1200 }),
        -1,
        false
      )
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
            backgroundColor: baseColor ?? colors.bgSkeleton as string,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            width: '50%',
            height: '100%',
            backgroundColor: shimmerColor ?? `${colors.accentPetrol}22`,
            transform: [{ skewX: '-20deg' }],
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}
