import { useEffect } from 'react';
import { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface AnimatedTabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string | ColorValue;
  size: number;
}

export function AnimatedTabIcon({ name, focused, color, size }: AnimatedTabIconProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 12, stiffness: 180 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
