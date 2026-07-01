import { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedNumberProps extends TextProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  duration = 800,
  formatFn,
  decimals = 0,
  style,
  ...props
}: AnimatedNumberProps) {
  const shared = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useAnimatedReaction(
    () => shared.value,
    (current) => {
      runOnJS(setDisplayValue)(current);
    },
    [shared]
  );

  useEffect(() => {
    shared.value = withTiming(value, { duration });
  }, [value, duration]);

  const text = formatFn
    ? formatFn(displayValue)
    : displayValue.toFixed(decimals);

  return (
    <Text style={style} {...props}>
      {text}
    </Text>
  );
}
