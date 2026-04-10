import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Platform,
  Alert, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';
import type { Client } from '../../types';
import { formatARS } from '../../lib/format';
import { ClienteDetalle } from '../../components/FichaCliente';

// ─── Sub-componentes ─────────────────────────────────────────

function ClientRow({ client, selected, onPress }: {
  client: Client; selected: boolean; onPress: () => void;
}) {
  const saldo = client.saldo ?? 0;
  const esAFavor = saldo < 0;
  const alDia    = saldo === 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: selected ? '#eff6ff' : '#fff',
        borderLeftWidth: selected ? 3 : 0,
        borderLeftColor: '#2563eb',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      <Text style={{ flex: 1, fontSize: 14, color: '#1e293b', fontWeight: selected ? '600' : '400' }}
        numberOfLines={1}>
        {client.nombre}
      </Text>
      <Text style={{
        fontSize: 13, fontWeight: '600',
        color: alDia ? '#64748b' : esAFavor ? '#2563eb' : '#ef4444',
        marginLeft: 8,
      }}>
        {alDia ? '—' : (esAFavor ? '+' : '') + formatARS(saldo)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ──────────────────────────────────────

export default function ClientesScreen() {
  const {
    clients, clientsLoading, loadClients,
    organization, selectedClientId, selectClient,
  } = useAppStore();
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;
  const router     = useRouter();
  const { width }  = useWindowDimensions();
  const isDesktop  = Platform.OS === 'web' && width >= 768;
  const isWeb      = Platform.OS === 'web';
  const [search, setSearch] = useState('');
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [mobileDetalle, setMobileDetalle] = useState(false);

  useEffect(() => {
    if (organization) loadClients();
  }, [organization]);

  const filtered = clients.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.telefono ?? '').includes(search)
  );

  const totalDeuda = clients
    .filter((c) => (c.saldo ?? 0) > 0)
    .reduce((acc, c) => acc + (c.saldo ?? 0), 0);

  const handleSelectClient = (clientId: string) => {
    if (isDesktop) {
      selectClient(clientId);
    } else if (isWeb) {
      // móvil web: mostrar detalle en la misma pantalla
      selectClient(clientId);
      setMobileDetalle(true);
    } else {
      router.push(`/cliente/${clientId}`);
    }
  };

  // ── Panel izquierdo (lista) ──
  const ListaPanel = (
    <View style={{
      width: isDesktop ? 300 : undefined,
      flex: isDesktop ? undefined : 1,
      backgroundColor: '#fff',
      borderRightWidth: isDesktop ? 1 : 0,
      borderRightColor: '#e2e8f0',
    }}>
      {/* Totalizador */}
      <View style={{ backgroundColor: '#2563eb', padding: 16 }}>
        <Text style={{ color: '#bfdbfe', fontSize: 12 }}>Total adeudado</Text>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
          {formatARS(totalDeuda)}
        </Text>
        <Text style={{ color: '#93c5fd', fontSize: 12, marginTop: 2 }}>
          {clients.filter((c) => (c.saldo ?? 0) > 0).length} clientes con deuda
        </Text>
      </View>

      {/* Buscador */}
      <View style={{
        margin: 10, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f8fafc', borderRadius: 8,
        borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10,
      }}>
        <Text style={{ color: '#94a3b8', marginRight: 6 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, paddingVertical: 8, fontSize: 14, color: '#1e293b' }}
          placeholder="Buscar..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Lista */}
      {clientsLoading && clients.length === 0 ? (
        <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              selected={isWeb && selectedClientId === item.id}
              onPress={() => handleSelectClient(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 32, fontSize: 13 }}>
              {search ? 'Sin resultados' : 'No hay clientes'}
            </Text>
          }
        />
      )}

      {/* Botón nuevo cliente */}
      <TouchableOpacity
        onPress={() => isWeb ? setShowNuevoCliente(true) : router.push('/cliente/nuevo')}
        style={{
          marginHorizontal: 12, marginTop: 12, backgroundColor: '#2563eb', borderRadius: 10,
          paddingVertical: 12, alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nuevo cliente</Text>
      </TouchableOpacity>

      {/* Ver archivados */}
      <TouchableOpacity
        onPress={() => setShowArchived(true)}
        style={{ marginHorizontal: 12, marginTop: 8, marginBottom: 12, paddingVertical: 10, alignItems: 'center' }}
      >
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>📦 Ver archivados</Text>
      </TouchableOpacity>
    </View>
  );

  // Móvil web: mostrar detalle con botón atrás
  if (isWeb && !isDesktop && mobileDetalle && selectedClientId) {
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          onPress={() => { setMobileDetalle(false); selectClient(null); }}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 16, paddingVertical: 12,
            backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
          }}
        >
          <Text style={{ fontSize: 18, color: '#2563eb' }}>←</Text>
          <Text style={{ color: '#2563eb', fontWeight: '500' }}>Volver a clientes</Text>
        </TouchableOpacity>
        {selectedClient && <ClienteDetalle client={selectedClient} />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {ListaPanel}

      {/* Panel derecho — solo en desktop web */}
      {isDesktop && (
        <View style={{ flex: 1 }}>
          {selectedClient ? (
            <ClienteDetalle client={selectedClient} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👈</Text>
              <Text style={{ fontSize: 16, color: '#94a3b8' }}>Seleccioná un cliente para ver su ficha</Text>
            </View>
          )}
        </View>
      )}

      {/* Modal nuevo cliente (web) */}
      {isWeb && (
        <NuevoClienteModal
          visible={showNuevoCliente}
          onClose={() => setShowNuevoCliente(false)}
        />
      )}

      {/* Modal archivados */}
      <ArchivedModal
        visible={showArchived}
        onClose={() => setShowArchived(false)}
      />
    </View>
  );
}

// ─── Modal archivados ────────────────────────────────────────

function ArchivedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { archivedClients, loadArchivedClients, desarchivarCliente, loadTransactions } = useAppStore();
  const [loading, setLoading]             = useState(false);
  const [detalle, setDetalle]             = useState<Client | null>(null);
  const [loadingId, setLoadingId]         = useState<string | null>(null);

  useEffect(() => {
    if (visible) loadArchivedClients();
  }, [visible]);

  const handleDesarchivar = async (c: Client) => {
    setLoadingId(c.id);
    await desarchivarCliente(c.id);
    setLoadingId(null);
  };

  const handleVerHistorial = async (c: Client) => {
    setLoading(true);
    await loadTransactions(c.id);
    setLoading(false);
    setDetalle(c);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85%' as any, overflow: 'hidden' }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            {detalle && (
              <TouchableOpacity onPress={() => setDetalle(null)} style={{ marginRight: 12 }}>
                <Text style={{ fontSize: 18, color: '#2563eb' }}>←</Text>
              </TouchableOpacity>
            )}
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' }}>
              {detalle ? detalle.nombre : 'Clientes archivados'}
            </Text>
            <TouchableOpacity onPress={() => { setDetalle(null); onClose(); }}>
              <Text style={{ fontSize: 20, color: '#94a3b8' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          {detalle ? (
            <ClienteDetalle client={detalle} />
          ) : loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#2563eb" />
            </View>
          ) : archivedClients.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
              <Text style={{ color: '#94a3b8', fontSize: 14 }}>No hay clientes archivados</Text>
            </View>
          ) : (
            <FlatList
              data={archivedClients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const saldo = item.saldo ?? 0;
                const busy  = loadingId === item.id;
                return (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 20, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>{item.nombre}</Text>
                      <Text style={{ fontSize: 12, color: saldo > 0 ? '#ef4444' : saldo < 0 ? '#2563eb' : '#94a3b8', marginTop: 2 }}>
                        {saldo === 0 ? 'Al día' : formatARS(saldo)}
                      </Text>
                    </View>
                    {busy ? (
                      <ActivityIndicator color="#2563eb" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleVerHistorial(item)}
                          style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, backgroundColor: '#f1f5f9' }}
                        >
                          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500' }}>Ver historial</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDesarchivar(item)}
                          style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, backgroundColor: '#dcfce7' }}
                        >
                          <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '500' }}>Desarchivar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal nuevo cliente ─────────────────────────────────────

function NuevoClienteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createClient } = useAppStore();
  const [nombre, setNombre]     = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas]       = useState('');
  const [loading, setLoading]   = useState(false);

  const reset = () => { setNombre(''); setTelefono(''); setNotas(''); };

  const handleGuardar = async () => {
    if (!nombre.trim()) { Alert.alert('Requerido', 'El nombre es obligatorio'); return; }
    setLoading(true);
    const err = await createClient({ nombre, telefono, notas });
    setLoading(false);
    if (err) { Alert.alert('Error', err); return; }
    reset();
    onClose();
  };

  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 };
  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: '#1e293b',
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
      }}>
        <View style={{
          backgroundColor: '#fff', borderRadius: 16, padding: 24,
          width: '100%', maxWidth: 420,
        }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 16 }}>
            Nuevo cliente
          </Text>
          <View style={{ gap: 12 }}>
            <View>
              <Text style={labelStyle}>Nombre *</Text>
              <TextInput style={inputStyle} placeholder="Ej: Juan Pérez"
                placeholderTextColor="#94a3b8" value={nombre} onChangeText={setNombre}
                autoCapitalize="words" autoFocus />
            </View>
            <View>
              <Text style={labelStyle}>Teléfono</Text>
              <TextInput style={inputStyle} placeholder="Ej: 11 1234-5678"
                placeholderTextColor="#94a3b8" value={telefono} onChangeText={setTelefono} />
            </View>
            <View>
              <Text style={labelStyle}>Notas</Text>
              <TextInput style={[inputStyle, { minHeight: 60 }]}
                placeholder="Información adicional..."
                placeholderTextColor="#94a3b8" value={notas} onChangeText={setNotas}
                multiline textAlignVertical="top" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity onPress={() => { reset(); onClose(); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleGuardar} disabled={loading}
                style={{ flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
