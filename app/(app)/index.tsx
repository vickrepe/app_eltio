import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Modal, Platform,
  KeyboardAvoidingView, Alert, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';
import type { Client, Transaction, TransactionWithSaldo } from '../../types';

// ─── Helpers ────────────────────────────────────────────────

function formatARS(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(Math.abs(n));
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function todayDisplay(): string {
  return formatFecha(todayISO());
}

/** Diálogo de confirmación compatible con web y mobile */
function confirmar(mensaje: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(mensaje));
  }
  return new Promise((resolve) => {
    Alert.alert('Confirmar', mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Aceptar', onPress: () => resolve(true) },
    ]);
  });
}

/** Calcula el saldo acumulado por fila.
 *  Las transacciones anuladas no afectan el saldo pero siguen visibles. */
function calcularSaldos(txs: Transaction[]): TransactionWithSaldo[] {
  const asc = [...txs].reverse();
  let acum = 0;
  return asc.map((tx) => {
    if (!tx.anulada) acum += tx.debe - tx.entrega;
    return { ...tx, saldo_acumulado: acum };
  }).reverse();
}

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

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#f8fafc', borderRadius: 12,
      padding: 14, marginHorizontal: 4,
    }}>
      <Text style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function MovimientoForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
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
    setLoading(true);
    const err = await createTransaction({
      client_id: clientId, debe: debeNum, entrega: entregaNum,
      observaciones: obs, fecha,
    });
    setLoading(false);
    if (err) { Alert.alert('Error', err); return; }
    onClose();
  };

  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 };
  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: '#1e293b',
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Debe ($)</Text>
            <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#94a3b8"
              value={debe} onChangeText={setDebe} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Entrega ($)</Text>
            <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#94a3b8"
              value={entrega} onChangeText={setEntrega} keyboardType="decimal-pad" />
          </View>
        </View>

        <View>
          <Text style={labelStyle}>Fecha</Text>
          <TextInput style={inputStyle} placeholder="2026-04-09" placeholderTextColor="#94a3b8"
            value={fecha} onChangeText={setFecha} />
        </View>

        <View>
          <Text style={labelStyle}>Observaciones</Text>
          <TextInput style={[inputStyle, { minHeight: 60 }]}
            placeholder="Ej: pagó con tarjeta..." placeholderTextColor="#94a3b8"
            value={obs} onChangeText={setObs} multiline textAlignVertical="top" />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TouchableOpacity onPress={onClose}
            style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleGuardar} disabled={loading}
            style={{ flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar movimiento</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Panel derecho: ficha del cliente ───────────────────────

function FilaTransaccion({ tx, clientId }: { tx: TransactionWithSaldo; clientId: string }) {
  const { cancelarTransaccion } = useAppStore();
  const [hoverTrash, setHoverTrash] = useState(false);
  const [loading, setLoading]       = useState(false);

  const tachado = tx.anulada;
  const textStyle = { fontSize: 13, textDecorationLine: tachado ? 'line-through' as const : 'none' as const };

  const handleAnular = async () => {
    const ok = await confirmar('¿Anular este movimiento? El saldo se actualizará.');
    if (!ok) return;
    setLoading(true);
    await cancelarTransaccion(tx.id, clientId);
    setLoading(false);
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 28, paddingVertical: 11,
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
      opacity: tachado ? 0.5 : 1,
    }}>
      <Text style={{ ...textStyle, flex: 1, color: '#475569' }}>
        {formatFecha(tx.fecha)}
      </Text>
      <Text style={{
        ...textStyle, flex: 1, textAlign: 'right',
        color: tx.debe > 0 ? '#ef4444' : '#cbd5e1',
        fontWeight: tx.debe > 0 ? '600' : '400',
      }}>
        {tx.debe > 0 ? formatARS(tx.debe) : '—'}
      </Text>
      <Text style={{
        ...textStyle, flex: 1, textAlign: 'right',
        color: tx.entrega > 0 ? '#22c55e' : '#cbd5e1',
        fontWeight: tx.entrega > 0 ? '600' : '400',
      }}>
        {tx.entrega > 0 ? formatARS(tx.entrega) : '—'}
      </Text>
      <Text style={{
        ...textStyle, flex: 1, textAlign: 'right', fontWeight: '700',
        color: tachado ? '#94a3b8' : tx.saldo_acumulado > 0 ? '#ef4444' : tx.saldo_acumulado < 0 ? '#2563eb' : '#64748b',
      }}>
        {tachado ? '—' : formatARS(tx.saldo_acumulado)}
      </Text>
      <Text style={{ ...textStyle, flex: 2, fontSize: 13, color: '#94a3b8', paddingLeft: 12 }} numberOfLines={1}>
        {tachado ? 'ANULADA' : (tx.observaciones ?? '—')}
      </Text>
      {/* Papelera */}
      <TouchableOpacity
        onPress={handleAnular}
        disabled={tachado || loading}
        // @ts-ignore — onMouseEnter/Leave son válidos en web
        onMouseEnter={() => setHoverTrash(true)}
        onMouseLeave={() => setHoverTrash(false)}
        style={{
          width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
          backgroundColor: tachado ? 'transparent' : hoverTrash ? '#fee2e2' : 'transparent',
          marginLeft: 8,
        }}
      >
        <Text style={{ fontSize: 14, opacity: tachado ? 0.2 : hoverTrash ? 1 : 0.4 }}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

function ClienteDetalle({ clientId }: { clientId: string }) {
  const { clients, transactions, transactionsLoading, archivarCliente } = useAppStore();
  const [showForm, setShowForm]       = useState(false);
  const [hoverArchivar, setHoverArchivar] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  if (!client) return null;

  const saldo    = client.saldo ?? 0;
  const esAFavor = saldo < 0;
  const alDia    = saldo === 0;

  const txsConSaldo = calcularSaldos(transactions);

  const ultimoDebe    = transactions.find((t) => t.debe > 0 && !t.anulada);
  const ultimaEntrega = transactions.find((t) => t.entrega > 0 && !t.anulada);

  const handleArchivar = async () => {
    const ok = await confirmar(`¿Archivar a ${client.nombre}? Va a desaparecer de la lista pero se conserva su historial.`);
    if (!ok) return;
    await archivarCliente(clientId);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 20,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1e293b' }}>{client.nombre}</Text>
            {client.telefono
              ? <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{client.telefono}</Text>
              : null}
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Hoy: {todayDisplay()}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* Botón archivar */}
            <TouchableOpacity
              onPress={handleArchivar}
              // @ts-ignore
              onMouseEnter={() => setHoverArchivar(true)}
              onMouseLeave={() => setHoverArchivar(false)}
              style={{
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                backgroundColor: hoverArchivar ? '#cbd5e1' : '#e2e8f0',
              }}
            >
              <Text style={{ color: hoverArchivar ? '#475569' : '#94a3b8', fontWeight: '500', fontSize: 13 }}>
                Archivar cliente
              </Text>
            </TouchableOpacity>

            {/* Botón nuevo movimiento */}
            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{
                backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 10,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nuevo movimiento</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', marginTop: 16, marginHorizontal: -4 }}>
          <KPI
            label="Saldo actual"
            value={alDia ? 'Al día' : (esAFavor ? 'A favor ' : '') + formatARS(saldo)}
            color={alDia ? '#64748b' : esAFavor ? '#2563eb' : '#ef4444'}
          />
          <KPI label="Último debe"
            value={ultimoDebe ? formatARS(ultimoDebe.debe) : '—'} color="#ef4444" />
          <KPI label="Último pago"
            value={ultimaEntrega ? formatARS(ultimaEntrega.entrega) : '—'} color="#22c55e" />
        </View>
      </View>

      {/* Tabla */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {transactionsLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : txsConSaldo.length === 0 ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
            <Text style={{ color: '#94a3b8' }}>Sin movimientos todavía</Text>
          </View>
        ) : (
          <View>
            {/* Encabezado */}
            <View style={{
              flexDirection: 'row', paddingHorizontal: 28, paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f1f5f9',
            }}>
              {['FECHA', 'DEBE', 'ENTREGA', 'SALDO', 'OBSERVACIONES'].map((h, i) => (
                <Text key={h} style={{
                  flex: i === 4 ? 2 : 1, fontSize: 11, fontWeight: '600', color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  textAlign: i > 0 && i < 4 ? 'right' : 'left',
                }}>
                  {h}
                </Text>
              ))}
              <View style={{ width: 36 }} />
            </View>

            {/* Filas */}
            {txsConSaldo.map((tx) => (
              <FilaTransaccion key={tx.id} tx={tx} clientId={clientId} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal nuevo movimiento */}
      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center', alignItems: 'center', padding: 20,
        }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 480,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
          }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 16 }}>
              Nuevo movimiento — {client.nombre}
            </Text>
            <MovimientoForm clientId={clientId} onClose={() => setShowForm(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────

export default function ClientesScreen() {
  const {
    clients, clientsLoading, loadClients,
    organization, selectedClientId, selectClient,
  } = useAppStore();
  const router     = useRouter();
  const { width }  = useWindowDimensions();
  const isDesktop  = Platform.OS === 'web' && width >= 768;
  const isWeb      = Platform.OS === 'web';
  const [search, setSearch] = useState('');
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
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
      width: isWeb ? 300 : undefined,
      flex: isWeb ? undefined : 1,
      backgroundColor: '#fff',
      borderRightWidth: isWeb ? 1 : 0,
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
          margin: 12, backgroundColor: '#2563eb', borderRadius: 10,
          paddingVertical: 12, alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nuevo cliente</Text>
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
        <ClienteDetalle clientId={selectedClientId} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {ListaPanel}

      {/* Panel derecho — solo en desktop web */}
      {isDesktop && (
        <View style={{ flex: 1 }}>
          {selectedClientId ? (
            <ClienteDetalle clientId={selectedClientId} />
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
    </View>
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
