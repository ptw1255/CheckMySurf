// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.bg, borderTopColor: 'rgba(255,255,255,0.08)' },
      tabBarActiveTintColor: colors.blue,
      tabBarInactiveTintColor: colors.textDim,
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Beaches',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'water' : 'water-outline'} color={color} size={24} />
        ),
      }} />
      <Tabs.Screen name="detail" options={{
        title: 'Detail',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'analytics' : 'analytics-outline'} color={color} size={24} />
        ),
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={24} />
        ),
      }} />
    </Tabs>
  );
}
