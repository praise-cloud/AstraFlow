import { ReactNode } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAppColor } from '@/hooks/useAppColor';

type ColorVariant = 'primary' | 'success' | 'warning' | 'danger';

interface ColorPopViewProps {
  children: ReactNode;
  variant?: ColorVariant;
  position?: 'top' | 'left' | 'bottom' | 'right';
  thickness?: number;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS = {
  primary: 'accentPetrol' as const,
  success: 'trendDown' as const,
  warning: 'riskModerate' as const,
  danger: 'riskHigh' as const,
};

const POSITION_STYLES: Record<string, (t: number) => ViewStyle> = {
  top: (t) => ({ position: 'absolute', top: 0, left: 0, right: 0, height: t, borderTopLeftRadius: t, borderTopRightRadius: t }),
  left: (t) => ({ position: 'absolute', top: 0, left: 0, bottom: 0, width: t, borderTopLeftRadius: t, borderBottomLeftRadius: t }),
  bottom: (t) => ({ position: 'absolute', bottom: 0, left: 0, right: 0, height: t, borderBottomLeftRadius: t, borderBottomRightRadius: t }),
  right: (t) => ({ position: 'absolute', top: 0, right: 0, bottom: 0, width: t, borderTopRightRadius: t, borderBottomRightRadius: t }),
};

export function ColorPopView({
  children,
  variant = 'primary',
  position = 'top',
  thickness = 4,
  style,
}: ColorPopViewProps) {
  const colors = useAppColor();
  const colorKey = VARIANT_COLORS[variant];
  const accentColor = colors[colorKey];

  return (
    <View style={[{ position: 'relative', overflow: 'hidden' }, style]}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[
          POSITION_STYLES[position](thickness),
          { backgroundColor: accentColor as string, opacity: 0.7 },
        ]}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
