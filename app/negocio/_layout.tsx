import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAppStore } from '../../lib/store';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

const NEGOCIO_ROLES = ['owner_negocio', 'empleado_negocio'];

export default function NegocioLayout() {
  const { profile } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (profile && !NEGOCIO_ROLES.includes(profile.rol) && profile.rol !== 'owner') {
      router.replace('/(app)');
    }
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor:  Colors.border,
        },
        headerStyle:      { backgroundColor: Colors.card },
        headerTintColor:  Colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Caja',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏧" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: 'Metas',
          href: profile?.rol === 'owner' ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="estadisticas"
        options={{
          title: 'Estadísticas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
