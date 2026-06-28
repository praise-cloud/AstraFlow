import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LightColors, DarkColors } from '@/theme/appColors';
import { useTheme } from '@/context/ThemeContext';

const TAB_ICONS: Record<string, { focused: any; unfocused: any }> = {
  index: { focused: 'home', unfocused: 'home-outline' },
  prices: { focused: 'cash', unfocused: 'cash-outline' },
  predict: { focused: 'analytics', unfocused: 'analytics-outline' },
  routes: { focused: 'map', unfocused: 'map-outline' },
  profile: { focused: 'person', unfocused: 'person-outline' },
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? DarkColors : LightColors;
  const icon = TAB_ICONS[name];
  if (!icon) return null;
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: colors.bgTabActive }]}>
      <Ionicons
        name={focused ? icon.focused : icon.unfocused}
        size={22}
        color={focused ? colors.tabActive : colors.tabInactive}
      />
      <Text style={[styles.tabLabel, { color: focused ? colors.tabActive : colors.tabInactive }]}>
        {name === 'index' ? 'Home' : name.charAt(0).toUpperCase() + name.slice(1)}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? DarkColors : LightColors;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.tabBg, borderTopColor: colors.tabBorder, borderTopWidth: 1, height: 70, paddingBottom: 8, paddingTop: 8 },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="prices"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="prices" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="predict" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="routes" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});
