import { Children, ReactNode, isValidElement, cloneElement } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeIn, SlideInUp, SlideInDown, SlideInLeft, SlideInRight } from 'react-native-reanimated';

type StaggerDirection = 'up' | 'down' | 'left' | 'right' | 'fade';

interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  duration?: number;
  direction?: StaggerDirection;
  style?: StyleProp<ViewStyle>;
}

const ENTRANCE_MAP = {
  up: FadeIn,
  down: SlideInDown,
  left: SlideInLeft,
  right: SlideInRight,
  fade: FadeIn,
};

export function StaggerContainer({
  children,
  staggerDelay = 80,
  duration = 300,
  direction = 'up',
  style,
}: StaggerContainerProps) {
  const items = Children.toArray(children);
  const Entrance = ENTRANCE_MAP[direction];

  return (
    <View style={style}>
      {items.map((child, index) => {
        if (!isValidElement(child)) return child;
        return (
          <Animated.View
            key={child.key ?? index}
            entering={Entrance.delay(index * staggerDelay).duration(duration)}
          >
            {child}
          </Animated.View>
        );
      })}
    </View>
  );
}
