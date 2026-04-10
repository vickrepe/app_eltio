import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, setSession, loadProfile, authLoading } = useAppStore();
  const router = useRouter();
  const segments = useSegments();

  // Escuchar cambios de sesión de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar perfil cuando hay sesión
  useEffect(() => {
    if (session) {
      loadProfile();
    }
  }, [session]);

  // Redirigir según estado de auth
  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup    = segments[0] === '(auth)';
    const inSetPassword  = segments[0] === 'set-password';

    if (!session && !inAuthGroup && !inSetPassword) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, authLoading, segments]);

  // Ocultar splash cuando ya sabemos el estado de auth
  useEffect(() => {
    if (!authLoading) {
      SplashScreen.hideAsync();
    }
  }, [authLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="set-password" options={{ headerShown: false }} />
      <Stack.Screen
        name="cliente/nuevo"
        options={{
          headerShown: true,
          title: 'Nuevo cliente',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="cliente/[id]"
        options={{
          headerShown: true,
          title: 'Detalle',
        }}
      />
      <Stack.Screen
        name="cliente/movimiento"
        options={{
          headerShown: true,
          title: 'Nuevo movimiento',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
