import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAppStore } from '../../lib/store';
import { ClienteDetalle } from '../../components/FichaCliente';

export default function NegocioCajaScreen() {
  const { cajaNegoClient, loadCajaNego, loadTransactions, organization } = useAppStore();

  useEffect(() => {
    if (organization) loadCajaNego();
  }, [organization]);

  useEffect(() => {
    if (cajaNegoClient) loadTransactions(cajaNegoClient.id);
  }, [cajaNegoClient?.id]);

  if (!cajaNegoClient) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#2563eb" />
        <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 13 }}>Cargando caja...</Text>
      </View>
    );
  }

  return <ClienteDetalle client={cajaNegoClient} variant="negocio" />;
}
