import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAppStore } from '../../lib/store';
import { ClienteDetalle } from '../../components/FichaCliente';

export default function CajaScreen() {
  const { cajaClient, loadCaja, loadTransactions, organization } = useAppStore();

  useEffect(() => {
    if (organization) loadCaja();
  }, [organization]);

  useEffect(() => {
    if (cajaClient) loadTransactions(cajaClient.id);
  }, [cajaClient?.id]);

  if (!cajaClient) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return <ClienteDetalle client={cajaClient} />;
}
