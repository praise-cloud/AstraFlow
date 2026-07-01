import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeInLeft, FadeInRight, FadeOut } from 'react-native-reanimated';

type SlideDirection = 'up' | 'down' | 'left' | 'right' | 'fade';

interface SlideInViewProps {
  children: ReactNode;
  direction?: SlideDirection;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const ENTRANCE_MAP = {
  up: FadeInUp,
  down: FadeInDown,
  left: FadeInLeft,
  right: FadeInRight,
  fade: FadeIn,
};

export function SlideInView({
  children,
  direction = 'up',
  duration = 400,
  delay = 0,
  style,
}: SlideInViewProps) {
  const Entrance = ENTRANCE_MAP[direction];

  return (
    <Animated.View
      entering={Entrance.duration(duration).delay(delay)}
      exiting={FadeOut.duration(200)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
