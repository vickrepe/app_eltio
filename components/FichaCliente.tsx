import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
  TextInput, useWindowDimensions, Linking,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppStore } from '../lib/store';
import type { Client, Transaction, TransactionWithSaldo } from '../types';
import { formatARS, formatFecha, formatHora, todayISO } from '../lib/format';

function todayDisplay(): string {
  return formatFecha(todayISO());
}

export function confirmar(mensaje: string): Promise<boolean> {
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

export function calcularSaldos(txs: Transaction[]): TransactionWithSaldo[] {
  const asc = [...txs].reverse();
  let acum = 0;
  return asc.map((tx) => {
    acum += tx.debe - tx.entrega;
    return { ...tx, saldo_acumulado: acum };
  }).reverse();
}

export const COL = { fecha: 80, debe: 72, entrega: 72, saldo: 72, trash: 30 };

// ─── KPI ─────────────────────────────────────────────────────

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#f8fafc', borderRadius: 10,
      padding: 10, marginHorizontal: 3,
    }}>
      <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}
        numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color, marginTop: 3 }}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
    </View>
  );
}

// ─── MovimientoForm ──────────────────────────────────────────

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

// ─── FilaTransaccion ─────────────────────────────────────────

function FilaTransaccion({ tx, clientId }: { tx: TransactionWithSaldo; clientId: string }) {
  const { cancelarTransaccion } = useAppStore();
  const [hoverTrash, setHoverTrash] = useState(false);
  const [showInfo, setShowInfo]     = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleEliminar = async () => {
    const ok = await confirmar('¿Eliminar este movimiento? El saldo se actualizará.');
    if (!ok) return;
    setLoading(true);
    await cancelarTransaccion(tx.id, clientId);
    setLoading(false);
  };

  const { width: sw } = useWindowDimensions();
  const narrow = sw < 768;
  const fs = narrow ? 11 : 13;
  const ph = narrow ? 8 : 28;
  const hora = formatHora(tx.created_at);
  const usuario = tx.creado_por_nombre ?? 'Desconocido';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      paddingHorizontal: ph, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    }}>
      {/* FECHA — clicable, abre modal con hora y usuario */}
      <TouchableOpacity
        onPress={() => setShowInfo(true)}
        style={{ width: COL.fecha }}
        activeOpacity={0.7}
      >
        <Text style={{
          fontSize: fs, color: '#2563eb',
          fontWeight: '600', textDecorationLine: 'underline',
        }} numberOfLines={1}>
          {formatFecha(tx.fecha)}
        </Text>
      </TouchableOpacity>

      {/* Modal de info */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 40 }}
          activeOpacity={1}
          onPress={() => setShowInfo(false)}
        >
          <View style={{
            backgroundColor: '#fff', borderRadius: 14, padding: 20,
            width: 240, gap: 10,
            shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
              Detalle del movimiento
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Fecha</Text>
              <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '500' }}>{formatFecha(tx.fecha)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Hora</Text>
              <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '500' }}>{hora}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>Registrado por</Text>
              <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '500' }}>{usuario}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <Text style={{
        width: COL.debe, fontSize: fs, textAlign: 'right',
        color: tx.debe > 0 ? '#ef4444' : '#cbd5e1',
        fontWeight: tx.debe > 0 ? '600' : '400',
      }} numberOfLines={1}>
        {tx.debe > 0 ? formatARS(tx.debe) : '—'}
      </Text>
      <Text style={{
        width: COL.entrega, fontSize: fs, textAlign: 'right',
        color: tx.entrega > 0 ? '#22c55e' : '#cbd5e1',
        fontWeight: tx.entrega > 0 ? '600' : '400',
      }} numberOfLines={1}>
        {tx.entrega > 0 ? formatARS(tx.entrega) : '—'}
      </Text>
      <Text style={{
        width: COL.saldo, fontSize: fs, textAlign: 'right', fontWeight: '700',
        color: tx.saldo_acumulado > 0 ? '#ef4444' : tx.saldo_acumulado < 0 ? '#2563eb' : '#64748b',
      }} numberOfLines={1}>
        {formatARS(tx.saldo_acumulado)}
      </Text>
      <Text style={{ flex: 1, fontSize: fs, color: '#94a3b8', paddingLeft: 8 }}>
        {tx.observaciones ?? '—'}
      </Text>
      <TouchableOpacity
        onPress={handleEliminar}
        disabled={loading}
        // @ts-ignore
        onMouseEnter={() => setHoverTrash(true)}
        onMouseLeave={() => setHoverTrash(false)}
        style={{
          width: COL.trash, height: 22, borderRadius: 6,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: hoverTrash ? '#fee2e2' : 'transparent',
        }}
      >
        {loading
          ? <ActivityIndicator size="small" color="#ef4444" />
          : <Text style={{ fontSize: 13, opacity: hoverTrash ? 1 : 0.4 }}>🗑</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── EnviarModal ─────────────────────────────────────────────

// Parsea un número guardado en sus 3 partes
export function parseTelefono(tel: string): { codPais: string; codCiud: string; local: string } {
  const d = tel.replace(/\D/g, '');
  if (d.startsWith('54') && d.length > 2) {
    const rest = d.slice(2);
    if (rest.startsWith('345') && rest.length > 3) return { codPais: '54', codCiud: '345', local: rest.slice(3) };
    return { codPais: '54', codCiud: '345', local: rest };
  }
  if (d.startsWith('345') && d.length > 3) return { codPais: '54', codCiud: '345', local: d.slice(3) };
  return { codPais: '54', codCiud: '345', local: d };
}

// Combina las 3 partes en un string para guardar en DB
export function combinaTel(codPais: string, codCiud: string, local: string): string {
  const l = local.replace(/\D/g, '');
  if (!l) return '';
  return codPais.replace(/\D/g, '') + codCiud.replace(/\D/g, '') + l;
}

// ─── TelInput ────────────────────────────────────────────────
export function TelInput({
  codPais, codCiud, local,
  onChangePais, onChangeCiud, onChangeLocal,
  inputStyle, labelStyle,
}: {
  codPais: string; codCiud: string; local: string;
  onChangePais: (v: string) => void;
  onChangeCiud: (v: string) => void;
  onChangeLocal: (v: string) => void;
  inputStyle: object; labelStyle: object;
}) {
  return (
    <View>
      <Text style={labelStyle}>Teléfono</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ width: 52 }}>
          <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, textAlign: 'center' }}>Cód. País</Text>
          <TextInput
            style={[inputStyle, { textAlign: 'center' }]}
            value={codPais}
            onChangeText={onChangePais}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={{ width: 60 }}>
          <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, textAlign: 'center' }}>Cód. Ciudad</Text>
          <TextInput
            style={[inputStyle, { textAlign: 'center' }]}
            value={codCiud}
            onChangeText={onChangeCiud}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Número</Text>
          <TextInput
            style={inputStyle}
            value={local}
            onChangeText={onChangeLocal}
            keyboardType="number-pad"
            placeholder="4123456"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>
    </View>
  );
}

function EnviarModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { transactions, updateClient } = useAppStore();
  const saldo    = client.saldo ?? 0;
  const esAFavor = saldo < 0;
  const alDia    = saldo === 0;
  const saldoLabel = alDia ? 'Al día' : esAFavor ? 'A favor' : 'Pendiente de pago';
  const saldoColor = alDia ? '#64748b' : esAFavor ? '#2563eb' : '#ef4444';
  const ultimos10  = transactions.slice(0, 10);

  const defaultMensaje = alDia
    ? `Hola ${client.nombre}, le informamos que su cuenta está al día. ¡Muchas gracias!`
    : `Hola ${client.nombre}, le recordamos que tiene un saldo ${esAFavor ? `a favor de ${formatARS(Math.abs(saldo))}` : `pendiente de pago de ${formatARS(saldo)}`}. Por favor, para evitar acumulación pase por la agencia para regularizarlo.`;

  const telInicial = parseTelefono(client.telefono ?? '');
  const [nombre, setNombre]     = useState(client.nombre);
  const [mensaje, setMensaje]   = useState(defaultMensaje);
  const [codPais, setCodPais]   = useState(telInicial.codPais);
  const [codCiud, setCodCiud]   = useState(telInicial.codCiud);
  const [localTel, setLocalTel] = useState(telInicial.local);

  const numeroWA = combinaTel(codPais, codCiud, localTel);

  const handleEnviar = async () => {
    const movimientosTexto = ultimos10.map((t) => {
      const partes = [];
      if (t.debe    > 0) partes.push(`Debe: ${formatARS(t.debe)}`);
      if (t.entrega > 0) partes.push(`Entrega: ${formatARS(t.entrega)}`);
      if (t.observaciones) partes.push(t.observaciones);
      return `${formatFecha(t.fecha)} | ${partes.join(' | ')}`;
    }).join('\n');

    const texto = [
      `*${client.nombre}*`,
      `${saldoLabel}: ${formatARS(Math.abs(saldo))}`,
      '',
      ultimos10.length > 0 ? `_Últimos movimientos:_\n${movimientosTexto}` : '',
      '',
      mensaje,
    ].filter(Boolean).join('\n');

    const url = numeroWA
      ? `https://wa.me/${numeroWA}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }

    // Si el cliente no tenía teléfono y se ingresó uno, ofrecer guardarlo
    if (!client.telefono && numeroWA) {
      const guardar = await confirmar(`¿Guardar este número como teléfono de ${client.nombre}?`);
      if (guardar) {
        await updateClient(client.id, {
          nombre:   client.nombre,
          telefono: numeroWA,
          notas:    client.notas ?? '',
        });
      }
    }
  };

  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1e293b',
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 480 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#1e293b' }}>Enviar resumen</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ fontSize: 20, color: '#94a3b8' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 18, gap: 16 }}>

              {/* Preview card */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                {/* Nombre y saldo */}
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>{client.nombre}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: saldoColor, marginBottom: 12 }}>
                  {saldoLabel}: {formatARS(Math.abs(saldo))}
                </Text>

                {/* Últimos 10 movimientos */}
                {ultimos10.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }}>
                    <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                      Últimos movimientos
                    </Text>
                    {ultimos10.map((t) => (
                      <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text style={{ fontSize: 12, color: '#64748b', width: 70 }}>{formatFecha(t.fecha)}</Text>
                        {t.debe > 0    && <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Debe: {formatARS(t.debe)}</Text>}
                        {t.entrega > 0 && <Text style={{ fontSize: 12, color: '#22c55e', fontWeight: '600' }}>Entrega: {formatARS(t.entrega)}</Text>}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Nombre destinatario */}
              <View>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Nombre en el mensaje</Text>
                <TextInput style={inputStyle} value={nombre} onChangeText={setNombre} />
              </View>

              {/* Teléfono */}
              <TelInput
                codPais={codPais} codCiud={codCiud} local={localTel}
                onChangePais={setCodPais} onChangeCiud={setCodCiud} onChangeLocal={setLocalTel}
                inputStyle={inputStyle}
                labelStyle={{ fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 }}
              />
              {!!numeroWA && (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: -8 }}>
                  Se enviará a: {numeroWA}
                </Text>
              )}
              {!numeroWA && (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: -8 }}>
                  Sin número: se abre WhatsApp para elegir contacto
                </Text>
              )}

              {/* Mensaje */}
              <View>
                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Mensaje</Text>
                <TextInput
                  style={[inputStyle, { minHeight: 90 }]}
                  value={mensaje}
                  onChangeText={setMensaje}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Botón WhatsApp */}
              <TouchableOpacity
                onPress={handleEnviar}
                style={{ backgroundColor: '#25d366', borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <FontAwesome5 name="whatsapp" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Enviar por WhatsApp</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── EditarClienteModal ──────────────────────────────────────

function EditarClienteModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { updateClient } = useAppStore();
  const telInicial = parseTelefono(client.telefono ?? '');
  const [nombre, setNombre]     = useState(client.nombre);
  const [codPais, setCodPais]   = useState(telInicial.codPais);
  const [codCiud, setCodCiud]   = useState(telInicial.codCiud);
  const [localTel, setLocalTel] = useState(telInicial.local);
  const [notas, setNotas]       = useState(client.notas ?? '');
  const [loading, setLoading]   = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) { Alert.alert('Requerido', 'El nombre es obligatorio'); return; }
    setLoading(true);
    const err = await updateClient(client.id, { nombre, telefono: combinaTel(codPais, codCiud, localTel), notas });
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
      }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 420 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 16 }}>
              Editar cliente
            </Text>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={labelStyle}>Nombre *</Text>
                <TextInput style={inputStyle} placeholder="Ej: Juan Pérez"
                  placeholderTextColor="#94a3b8" value={nombre} onChangeText={setNombre}
                  autoCapitalize="words" />
              </View>
              <TelInput
                codPais={codPais} codCiud={codCiud} local={localTel}
                onChangePais={setCodPais} onChangeCiud={setCodCiud} onChangeLocal={setLocalTel}
                inputStyle={inputStyle} labelStyle={labelStyle}
              />
              <View>
                <Text style={labelStyle}>Notas</Text>
                <TextInput style={[inputStyle, { minHeight: 60 }]}
                  placeholder="Información adicional..."
                  placeholderTextColor="#94a3b8" value={notas} onChangeText={setNotas}
                  multiline textAlignVertical="top" />
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
                    : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar cambios</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── ClienteDetalle ──────────────────────────────────────────

export function ClienteDetalle({ client }: { client: Client }) {
  const { transactions, transactionsLoading, archivarCliente } = useAppStore();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 768;
  const [showForm, setShowForm]           = useState(false);
  const [showEditar, setShowEditar]       = useState(false);
  const [showEnviar, setShowEnviar]       = useState(false);
  const [hoverArchivar, setHoverArchivar] = useState(false);
  const [hoverEditar, setHoverEditar]     = useState(false);
  const [hoverEnviar, setHoverEnviar]     = useState(false);

  const saldo    = client.saldo ?? 0;
  const esAFavor = saldo < 0;
  const alDia    = saldo === 0;

  const txsConSaldo = calcularSaldos(transactions);

  const ultimoDebe    = transactions.find((t) => t.debe > 0 && !t.anulada);
  const ultimaEntrega = transactions.find((t) => t.entrega > 0 && !t.anulada);

  const handleArchivar = async () => {
    const ok = await confirmar(`¿Archivar a ${client.nombre}? Va a desaparecer de la lista pero se conserva su historial.`);
    if (!ok) return;
    await archivarCliente(client.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Modal editar */}
      {showEditar && (
        <EditarClienteModal client={client} onClose={() => setShowEditar(false)} />
      )}

      {/* Modal enviar */}
      {showEnviar && (
        <EnviarModal client={client} onClose={() => setShowEnviar(false)} />
      )}

      {/* Header */}
      <View style={{
        backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 20,
        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
      }}>
        <View style={{ flexDirection: isNarrow ? 'column' : 'row', justifyContent: 'space-between', gap: 10 }}>
          <View>
            <Text style={{ fontSize: isNarrow ? 18 : 22, fontWeight: '700', color: '#1e293b' }}>{client.nombre}</Text>
            {client.telefono
              ? <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{client.telefono}</Text>
              : null}
            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Hoy: {todayDisplay()}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {!client.es_caja && client.activo && (
              <>
                <TouchableOpacity
                  onPress={() => setShowEditar(true)}
                  // @ts-ignore
                  onMouseEnter={() => setHoverEditar(true)}
                  onMouseLeave={() => setHoverEditar(false)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: hoverEditar ? '#e0f2fe' : '#e2e8f0',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowEnviar(true)}
                  // @ts-ignore
                  onMouseEnter={() => setHoverEnviar(true)}
                  onMouseLeave={() => setHoverEnviar(false)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: hoverEnviar ? '#dcfce7' : '#e2e8f0',
                  }}
                >
                  <FontAwesome5 name="whatsapp" size={16} color={hoverEnviar ? '#16a34a' : '#94a3b8'} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleArchivar}
                  // @ts-ignore
                  onMouseEnter={() => setHoverArchivar(true)}
                  onMouseLeave={() => setHoverArchivar(false)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: hoverArchivar ? '#cbd5e1' : '#e2e8f0',
                  }}
                >
                  <Text style={{ color: hoverArchivar ? '#475569' : '#94a3b8', fontWeight: '500', fontSize: 12 }}>
                    Archivar
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => setShowForm(true)}
              style={{
                flex: isNarrow ? 1 : undefined,
                backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 9,
                borderRadius: 9, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Nuevo movimiento</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', marginTop: 16, marginHorizontal: -4 }}>
          <KPI
            label="Saldo actual"
            value={alDia ? 'Al día' : formatARS(saldo)}
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
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: isNarrow ? 8 : 28, paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f1f5f9',
            }}>
              <Text style={{ width: COL.fecha, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>FECHA</Text>
              <Text style={{ width: COL.debe, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>DEBE</Text>
              <Text style={{ width: COL.entrega, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>ENTREGA</Text>
              <Text style={{ width: COL.saldo, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>SALDO</Text>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', paddingLeft: 8 }}>OBSERVACIONES</Text>
              <View style={{ width: COL.trash }} />
            </View>

            {/* Filas */}
            {txsConSaldo.map((tx) => (
              <FilaTransaccion key={tx.id} tx={tx} clientId={client.id} />
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
            <MovimientoForm clientId={client.id} onClose={() => setShowForm(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
