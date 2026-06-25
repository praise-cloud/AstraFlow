import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

const TAB_ICONS: Record<string, string> = {
  index: '🏠',
  prices: '💰',
  predict: '🔮',
  routes: '🗺️',
  profile: '👤',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
        {TAB_ICONS[name] || '●'}
      </Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {name === 'index' ? 'Home' : name.charAt(0).toUpperCase() + name.slice(1)}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#c4c6d4',
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: '#dbe1ff',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    color: '#747683',
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#003087',
    fontWeight: '600',
  },
});
