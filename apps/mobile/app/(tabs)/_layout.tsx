import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { palette } from '@/src/ui/theme';

type TabIconProps = {
  color: ColorValue;
  name: ComponentProps<typeof SymbolView>['name'];
};

function TabIcon({ color, name }: TabIconProps) {
  return <SymbolView name={name} tintColor={color} size={25} />;
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="companion"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.indigo,
        tabBarInactiveTintColor: palette.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopColor: palette.border,
          backgroundColor: palette.surface,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name={{ ios: 'house.fill', android: 'home', web: 'home' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: '闯关',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name={{ ios: 'flag.fill', android: 'flag', web: 'flag' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="companion"
        options={{
          title: 'AI伴学',
          tabBarIcon: ({ color }) => (
            <TabIcon
              color={color}
              name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} name={{ ios: 'person.fill', android: 'person', web: 'person' }} />
          ),
        }}
      />
    </Tabs>
  );
}
