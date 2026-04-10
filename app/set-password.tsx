import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    // Supabase detecta automáticamente el token en el hash de la URL
    // y dispara onAuthStateChange con SIGNED_IN
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGuardar = async () => {
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.replace('/(app)');
  };

  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1e293b',
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#2563eb" size="large" />
        <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>Verificando invitación...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', padding: 24 }}
    >
      <View style={{
        backgroundColor: '#fff', borderRadius: 20, padding: 28,
        shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 6 }}>
          Creá tu contraseña
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
          Elegí una contraseña para acceder a la aplicación.
        </Text>

        <View style={{ gap: 14 }}>
          <View>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6 }}>
              Contraseña
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
          </View>

          <View>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 6 }}>
              Confirmar contraseña
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="Repetí la contraseña"
              placeholderTextColor="#94a3b8"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={handleGuardar}
            disabled={loading}
            style={{
              backgroundColor: '#2563eb', borderRadius: 10,
              paddingVertical: 14, alignItems: 'center', marginTop: 4,
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirmar y entrar</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
