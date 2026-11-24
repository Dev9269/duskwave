import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors, fontFamily } from '@/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={String(color)} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search" color={String(color)} size={22} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Your Library',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'library' : 'library-outline'}
              color={String(color)}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ink,
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 4,
  },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.1 },
});
