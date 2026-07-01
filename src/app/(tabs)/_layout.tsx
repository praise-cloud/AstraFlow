import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LightColors, DarkColors } from '@/theme/appColors';
import { useTheme } from '@/context/ThemeContext';
import { AnimatedTabIcon } from '@/components/animations/AnimatedTabIcon';

const ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
  index: { focused: 'home', unfocused: 'home-outline' },
  prices: { focused: 'cash', unfocused: 'cash-outline' },
  predict: { focused: 'analytics', unfocused: 'analytics-outline' },
  routes: { focused: 'map', unfocused: 'map-outline' },
  profile: { focused: 'person', unfocused: 'person-outline' },
};

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = theme === 'dark' ? DarkColors : LightColors;
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused, color, size }) => (
            <AnimatedTabIcon name={focused ? ICONS.index.focused : ICONS.index.unfocused} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          title: t('tabs.prices'),
          tabBarIcon: ({ focused, color, size }) => (
            <AnimatedTabIcon name={focused ? ICONS.prices.focused : ICONS.prices.unfocused} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          title: t('tabs.predict'),
          tabBarIcon: ({ focused, color, size }) => (
            <AnimatedTabIcon name={focused ? ICONS.predict.focused : ICONS.predict.unfocused} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: t('tabs.routes'),
          tabBarIcon: ({ focused, color, size }) => (
            <AnimatedTabIcon name={focused ? ICONS.routes.focused : ICONS.routes.unfocused} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused, color, size }) => (
            <AnimatedTabIcon name={focused ? ICONS.profile.focused : ICONS.profile.unfocused} focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
