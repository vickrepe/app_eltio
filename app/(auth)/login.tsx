import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../../lib/store';

export default function LoginScreen() {
  const { signIn } = useAppStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Completá email y contraseña');
      return;
    }
    setError(null);
    setLoading(true);
    const err = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo / Nombre de la app */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primary-600 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">$</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-800">Eltio</Text>
          <Text className="text-slate-500 mt-1">Gestión de deudas y cobros</Text>
        </View>

        {/* Formulario */}
        <View className="gap-3">
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Email</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="tu@email.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Contraseña</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-primary-600 rounded-xl py-4 items-center mt-2"
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Iniciar sesión</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
