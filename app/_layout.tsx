import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

const NEGOCIO_ROLES = ['owner_negocio', 'empleado_negocio'];

export default function RootLayout() {
  const { session, profile, setSession, loadProfile, authLoading } = useAppStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadProfile();
  }, [session]);

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup   = segments[0] === '(auth)';
    const inSetPassword = segments[0] === 'set-password';
    const inNegocio     = segments[0] === 'negocio';
    const inApp         = segments[0] === '(app)';

    if (!session && !inAuthGroup && !inSetPassword) {
      router.replace('/(auth)/login');
      return;
    }

    // Al volver del login, esperar a que cargue el perfil para saber a dónde redirigir
    if (session && inAuthGroup) {
      if (!profile) return;
      router.replace(NEGOCIO_ROLES.includes(profile.rol) ? '/negocio' : '/(app)');
      return;
    }

    // Enforcer de fronteras cuando el perfil ya está cargado
    if (session && profile && profile.rol !== 'owner') {
      const isNegocioRole = NEGOCIO_ROLES.includes(profile.rol);
      if (isNegocioRole && inApp)     router.replace('/negocio');
      if (!isNegocioRole && inNegocio) router.replace('/(app)');
    }
  }, [session, authLoading, profile, segments]);

  useEffect(() => {
    if (!authLoading) SplashScreen.hideAsync();
  }, [authLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="negocio" />
      <Stack.Screen name="set-password" />
      <Stack.Screen name="metas" options={{ headerShown: true, title: 'Metas' }} />
      <Stack.Screen name="cliente/nuevo"    options={{ headerShown: true, title: 'Nuevo cliente', presentation: 'modal' }} />
      <Stack.Screen name="cliente/[id]"     options={{ headerShown: true, title: 'Detalle' }} />
      <Stack.Screen name="cliente/movimiento" options={{ headerShown: true, title: 'Nuevo movimiento', presentation: 'modal' }} />
    </Stack>
  );
}
