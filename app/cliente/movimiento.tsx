import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../lib/store';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function MovimientoScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { createTransaction } = useAppStore();

  const [debe, setDebe]       = useState('');
  const [entrega, setEntrega] = useState('');
  const [obs, setObs]         = useState('');
  const [fecha, setFecha]     = useState(todayISO());
  const [loading, setLoading] = useState(false);

  const handleGuardar = async () => {
    const debeNum    = parseFloat(debe.replace(',', '.'))    || 0;
    const entregaNum = parseFloat(entrega.replace(',', '.')) || 0;
    if (debeNum <= 0 && entregaNum <= 0) {
      Alert.alert('Error', 'Ingresá al menos un monto en Debe o Entrega');
      return;
    }
    if (!clientId) return;
    setLoading(true);
    const err = await createTransaction({
      client_id: clientId, debe: debeNum, entrega: entregaNum,
      observaciones: obs, fecha,
    });
    setLoading(false);
    if (err) { Alert.alert('Error', err); return; }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">Debe ($)</Text>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
                placeholder="0" placeholderTextColor="#94a3b8"
                value={debe} onChangeText={setDebe} keyboardType="decimal-pad" autoFocus
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-700 mb-1.5">Entrega ($)</Text>
              <TextInput
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
                placeholder="0" placeholderTextColor="#94a3b8"
                value={entrega} onChangeText={setEntrega} keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Fecha (AAAA-MM-DD)</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder={todayISO()} placeholderTextColor="#94a3b8"
              value={fecha} onChangeText={setFecha}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1.5">Observaciones</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
              placeholder="Ej: pagó con tarjeta..." placeholderTextColor="#94a3b8"
              value={obs} onChangeText={setObs} multiline numberOfLines={3} textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          <TouchableOpacity
            className="bg-primary-600 rounded-xl py-4 items-center mt-2"
            onPress={handleGuardar} disabled={loading} activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-semibold text-base">Guardar movimiento</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
