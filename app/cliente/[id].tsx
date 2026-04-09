import { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAppStore } from '../../lib/store';
import type { Transaction, TransactionWithSaldo } from '../../types';

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function calcularSaldos(txs: Transaction[]): TransactionWithSaldo[] {
  const asc = [...txs].reverse();
  let acum = 0;
  return asc.map((tx) => {
    acum += tx.debe - tx.entrega;
    return { ...tx, saldo_acumulado: acum };
  }).reverse();
}

function MovimientoItem({ tx }: { tx: TransactionWithSaldo }) {
  return (
    <View className="bg-white rounded-xl px-4 py-3 mb-2">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-slate-400 text-xs">{formatFecha(tx.fecha)}</Text>
        <Text style={{
          fontWeight: '700', fontSize: 14,
          color: tx.saldo_acumulado > 0 ? '#ef4444' : tx.saldo_acumulado < 0 ? '#2563eb' : '#64748b',
        }}>
          Saldo: {formatARS(tx.saldo_acumulado)}
        </Text>
      </View>
      <View className="flex-row gap-4">
        {tx.debe > 0 && (
          <Text className="text-red-500 text-sm font-semibold">Debe: {formatARS(tx.debe)}</Text>
        )}
        {tx.entrega > 0 && (
          <Text className="text-green-600 text-sm font-semibold">Entrega: {formatARS(tx.entrega)}</Text>
        )}
      </View>
      {tx.observaciones ? (
        <Text className="text-slate-400 text-xs mt-1">{tx.observaciones}</Text>
      ) : null}
    </View>
  );
}

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const nav     = useNavigation();
  const { clients, transactions, transactionsLoading, loadTransactions } = useAppStore();

  const client = clients.find((c) => c.id === id);

  useEffect(() => {
    if (id) loadTransactions(id);
  }, [id]);

  useEffect(() => {
    if (client) nav.setOptions({ title: client.nombre });
  }, [client]);

  if (!client) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const saldo    = client.saldo ?? 0;
  const esAFavor = saldo < 0;
  const alDia    = saldo === 0;
  const txsConSaldo = calcularSaldos(transactions);

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-6 pt-5 pb-6 border-b border-slate-100">
        <View className={`rounded-2xl px-5 py-4 mb-4 ${esAFavor ? 'bg-blue-50' : alDia ? 'bg-slate-50' : 'bg-red-50'}`}>
          <Text className={`text-xs uppercase tracking-wide font-medium ${
            esAFavor ? 'text-blue-400' : alDia ? 'text-slate-400' : 'text-red-400'
          }`}>
            {esAFavor ? 'A favor' : alDia ? 'Al día' : 'Debe'}
          </Text>
          <Text className={`text-3xl font-bold mt-1 ${
            esAFavor ? 'text-blue-600' : alDia ? 'text-slate-400' : 'text-red-500'
          }`}>
            {formatARS(saldo)}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-green-500 rounded-xl py-3.5 items-center"
            onPress={() => router.push({ pathname: '/cliente/movimiento', params: { clientId: id, tipo: 'pago' } })}
          >
            <Text className="text-white font-semibold">💰 Pago</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-red-500 rounded-xl py-3.5 items-center"
            onPress={() => router.push({ pathname: '/cliente/movimiento', params: { clientId: id, tipo: 'deuda' } })}
          >
            <Text className="text-white font-semibold">📋 Deuda</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 px-4 pt-4">
        <Text className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-3">
          Historial
        </Text>
        {transactionsLoading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <FlatList
            data={txsConSaldo}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MovimientoItem tx={item} />}
            ListEmptyComponent={
              <View className="items-center pt-10">
                <Text className="text-3xl mb-2">📭</Text>
                <Text className="text-slate-400 text-sm">Sin movimientos</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </View>
  );
}
