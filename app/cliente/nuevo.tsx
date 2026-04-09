import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';

export default function NuevoClienteScreen() {
  const router = useRouter();
  const { createClient } = useAppStore();

  const [nombre, setNombre]     = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre del cliente es obligatorio');
      return;
    }

    setLoading(true);
    const error = await createClient({ nombre, telefono, notas });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    router.back();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
          {/* Nombre */}
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">
              Nombre <Text className="text-red-400">*</Text>
            </Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="Ej: Juan Pérez"
              placeholderTextColor="#94a3b8"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          {/* Teléfono */}
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Teléfono</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="Ej: 11 1234-5678"
              placeholderTextColor="#94a3b8"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
            />
          </View>

          {/* Notas */}
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Notas</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="Información adicional..."
              placeholderTextColor="#94a3b8"
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          {/* Botón */}
          <TouchableOpacity
            className="bg-primary-600 rounded-xl py-4 items-center mt-2"
            onPress={handleGuardar}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Guardar cliente</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
