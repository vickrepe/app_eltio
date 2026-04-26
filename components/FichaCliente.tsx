import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, Modal,
  ActivityIndicator, Platform, Alert, KeyboardAvoidingView,
  TextInput, useWindowDimensions, Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppStore } from '../lib/store';
import type { Client, Transaction, TransactionWithSaldo } from '../types';
import { formatARS, formatSaldo, formatFecha, formatHora, todayISO } from '../lib/format';

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
    acum += tx.entrega - tx.debe;
    return { ...tx, saldo_acumulado: acum };
  }).reverse();
}

const MIN_TABLE_WIDTH = 539;
const OBS_WIDTH       = 90;

function useColWidths(variant?: string) {
  const { width: sw } = useWindowDimensions();
  const isNegocio = variant === 'negocio';
  const ph        = sw < 768 ? 8 : 28;
  const trash     = 30;
  // Ancho efectivo de la tabla: mínimo 539, o el ancho real de pantalla
  const tableWidth = Math.max(sw, MIN_TABLE_WIDTH);
  // Espacio disponible para las columnas principales (sin obs ni trash ni padding)
  const available = tableWidth - ph * 2 - OBS_WIDTH - trash;
  // Proporciones base
  const base = { fecha: 80, debe: 72, entrega: 72, saldo: 72, tipo: 88 };
  const total = base.fecha + base.debe + base.entrega + base.saldo
    + (isNegocio ? base.tipo : 0);
  return {
    fecha:   Math.round(available * base.fecha   / total),
    debe:    Math.round(available * base.debe    / total),
    entrega: Math.round(available * base.entrega / total),
    saldo:   Math.round(available * base.saldo   / total),
    tipo:    Math.round(available * base.tipo    / total),
    obs:     OBS_WIDTH,
    trash,
  };
}

// ─── AmountCell ──────────────────────────────────────────────

function AmountCell({
  value, style, children,
}: {
  value: string;
  style?: object;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  if (value === '—') return <View style={style}>{children}</View>;
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={(e) => { e.stopPropagation?.(); setVisible(true); }}
        style={style}
      >
        {children}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={{
            backgroundColor: '#1e293b', paddingHorizontal: 20, paddingVertical: 14,
            borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.5 }}>
              {value}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── KPI ─────────────────────────────────────────────────────

function KPI({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#f8fafc', borderRadius: 10,
      padding: 10, marginHorizontal: 3,
    }}>
      <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}
        numberOfLines={1}>
        {label}
      </Text>
      <AmountCell value={value} style={{ marginTop: 3 }}>
        <Text style={{ fontSize: bold ? 17 : 15, fontWeight: '700', color }}
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
        </Text>
      </AmountCell>
    </View>
  );
}

const TIPOS_FIJOS = ['Ventas', 'Empleados', 'Gastos Casa', 'Proveedores'];

// ─── DateField ───────────────────────────────────────────────

function DateField({
  value, onChange, label, inputStyle, labelStyle,
}: {
  value: string;          // ISO: YYYY-MM-DD
  onChange: (iso: string) => void;
  label: string;
  inputStyle: object;
  labelStyle: object;
}) {
  const [show, setShow] = useState(false);
  const date = new Date(value + 'T12:00:00');

  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={labelStyle}>{label}</Text>
        {/* @ts-ignore */}
        <input
          type="date"
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, paddingLeft: 12, paddingRight: 12,
            paddingTop: 8, paddingBottom: 8, fontSize: 15, color: '#1e293b',
            width: '100%', boxSizing: 'border-box' as any,
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={labelStyle}>{label}</Text>
      <TouchableOpacity style={inputStyle} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={{ fontSize: 15, color: '#1e293b' }}>{formatFecha(value)}</Text>
      </TouchableOpacity>
      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={date}
          mode="date"
          display="calendar"
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(selected.toISOString().split('T')[0]);
          }}
        />
      )}
      {show && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}
            activeOpacity={1}
            onPress={() => setShow(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 12 }}>
                  <TouchableOpacity onPress={() => setShow(false)}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#2563eb' }}>Listo</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  locale="es-AR"
                  onChange={(_, selected) => {
                    if (selected) onChange(selected.toISOString().split('T')[0]);
                  }}
                  style={{ height: 200 }}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ─── MovimientoForm ──────────────────────────────────────────

function MovimientoForm({
  clientId, variant, currentSaldo, onClose,
}: {
  clientId: string;
  variant?: string;
  currentSaldo?: number;
  onClose: () => void;
}) {
  const { createTransaction, negocioTipos, loadNegocioTipos, saveNegocioTipo } = useAppStore();
  const [debe, setDebe]       = useState('');
  const [entrega, setEntrega] = useState('');
  const [obs, setObs]         = useState('');
  const [fecha, setFecha]     = useState(todayISO());
  const [loading, setLoading] = useState(false);

  // Tipo (negocio only)
  const [selectedTipo, setSelectedTipo] = useState('');
  const [customNombre, setCustomNombre] = useState('');
  const [savingTipo, setSavingTipo]     = useState(false);
  const [tipoGuardado, setTipoGuardado] = useState(false);

  const isNegocio = variant === 'negocio';

  useEffect(() => {
    if (isNegocio) loadNegocioTipos();
  }, []);

  const customGuardados = negocioTipos.map(t => t.nombre).filter(n => !TIPOS_FIJOS.includes(n));
  const tiposDisponibles = [...TIPOS_FIJOS, ...customGuardados, 'Personalizado'];

  const handleGuardarTipoNuevo = async () => {
    if (!customNombre.trim()) return;
    setSavingTipo(true);
    const err = await saveNegocioTipo(customNombre.trim());
    setSavingTipo(false);
    if (!err) setTipoGuardado(true);
  };

  const handleGuardar = async () => {
    const debeNum    = parseFloat(debe.replace(',', '.'))    || 0;
    const entregaNum = parseFloat(entrega.replace(',', '.')) || 0;
    if (debeNum <= 0 && entregaNum <= 0) {
      Alert.alert('Error', 'Ingresá al menos un monto en Salida o Entrada');
      return;
    }
    const tipo = isNegocio
      ? (selectedTipo === 'Personalizado' ? customNombre.trim() || undefined : selectedTipo || undefined)
      : undefined;
    setLoading(true);
    const err = await createTransaction({
      client_id: clientId, debe: debeNum, entrega: entregaNum,
      observaciones: obs, fecha, tipo,
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
        {currentSaldo !== undefined && (
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: currentSaldo > 0 ? '#f0fdf4' : currentSaldo < 0 ? '#fef2f2' : '#f8fafc',
            borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
          }}>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}>Saldo actual</Text>
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: currentSaldo > 0 ? '#16a34a' : currentSaldo < 0 ? '#ef4444' : '#64748b',
            }}>
              {currentSaldo === 0 ? '—' : formatSaldo(currentSaldo)}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Salida ($)</Text>
            <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#94a3b8"
              value={debe} onChangeText={setDebe} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Entrada ($)</Text>
            <TextInput style={inputStyle} placeholder="0" placeholderTextColor="#94a3b8"
              value={entrega} onChangeText={setEntrega} keyboardType="decimal-pad" />
          </View>
        </View>

        <DateField
          label="Fecha"
          value={fecha}
          onChange={setFecha}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
        />

        {/* Tipo — solo en negocio */}
        {isNegocio && (
          <View>
            <Text style={labelStyle}>Tipo</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tiposDisponibles.map((t) => {
                const active = selectedTipo === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setSelectedTipo(active ? '' : t);
                      setTipoGuardado(false);
                      if (t !== 'Personalizado') setCustomNombre('');
                    }}
                    style={{
                      paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: active ? '#dc2626' : '#e2e8f0',
                      backgroundColor: active ? '#fee2e2' : '#f8fafc',
                    }}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: active ? '600' : '400',
                      color: active ? '#dc2626' : '#64748b',
                    }}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Campo personalizado */}
            {selectedTipo === 'Personalizado' && (
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[inputStyle, { flex: 1, paddingVertical: 8, fontSize: 14 }]}
                  placeholder="Nombre del tipo de gasto"
                  placeholderTextColor="#94a3b8"
                  value={customNombre}
                  onChangeText={(v) => { setCustomNombre(v); setTipoGuardado(false); }}
                  autoCapitalize="sentences"
                />
                <TouchableOpacity
                  onPress={handleGuardarTipoNuevo}
                  disabled={savingTipo || tipoGuardado || !customNombre.trim()}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
                    backgroundColor: tipoGuardado ? '#dcfce7' : '#fff7ed',
                    opacity: !customNombre.trim() ? 0.5 : 1,
                  }}
                >
                  {savingTipo
                    ? <ActivityIndicator size="small" color="#ea580c" />
                    : <Text style={{ fontSize: 12, fontWeight: '600', color: tipoGuardado ? '#16a34a' : '#ea580c' }}>
                        {tipoGuardado ? '✓ Guardado' : 'Guardar tipo'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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

function FilaTransaccion({ tx, clientId, variant }: { tx: TransactionWithSaldo; clientId: string; variant?: string }) {
  const { cancelarTransaccion, updateTransaction, negocioTipos, loadNegocioTipos } = useAppStore();
  const [hoverTrash, setHoverTrash] = useState(false);
  // 'none' | 'info' | 'edit' — single modal, two views
  const [modalMode, setModalMode]   = useState<'none' | 'info' | 'edit'>('none');
  const [loading, setLoading]       = useState(false);

  // Edit form state
  const [editDebe, setEditDebe]         = useState('');
  const [editEntrega, setEditEntrega]   = useState('');
  const [editObs, setEditObs]           = useState('');
  const [editFecha, setEditFecha]       = useState('');
  const [editTipo, setEditTipo]         = useState('');
  const [editCustom, setEditCustom]     = useState('');
  const [editSaving, setEditSaving]     = useState(false);

  const openEdit = () => {
    setEditDebe(tx.debe > 0 ? String(tx.debe) : '');
    setEditEntrega(tx.entrega > 0 ? String(tx.entrega) : '');
    setEditObs(tx.observaciones ?? '');
    setEditFecha(tx.fecha);
    const tipoFijo = TIPOS_FIJOS.includes(tx.tipo ?? '');
    const tipoCustomGuardado = negocioTipos.some(t => t.nombre === tx.tipo);
    if (!tx.tipo) {
      setEditTipo(''); setEditCustom('');
    } else if (tipoFijo || tipoCustomGuardado) {
      setEditTipo(tx.tipo ?? ''); setEditCustom('');
    } else {
      setEditTipo('Personalizado'); setEditCustom(tx.tipo ?? '');
    }
    setModalMode('edit');
  };

  const handleSaveEdit = async () => {
    const debeNum    = parseFloat(editDebe.replace(',', '.'))    || 0;
    const entregaNum = parseFloat(editEntrega.replace(',', '.')) || 0;
    if (debeNum <= 0 && entregaNum <= 0) {
      Alert.alert('Error', 'Ingresá al menos un monto en Salida o Entrada');
      return;
    }
    const tipoFinal = editTipo === 'Personalizado' ? editCustom.trim() || undefined : editTipo || undefined;
    setEditSaving(true);
    const err = await updateTransaction(tx.id, clientId, {
      debe: debeNum, entrega: entregaNum,
      observaciones: editObs, fecha: editFecha, tipo: tipoFinal,
    });
    setEditSaving(false);
    if (err) { Alert.alert('Error', err); return; }
    setModalMode('none');
  };

  useEffect(() => {
    if (variant === 'negocio') loadNegocioTipos();
  }, []);

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
  const col = useColWidths(variant);
  const hora = formatHora(tx.created_at);
  const usuario = tx.creado_por_nombre ?? 'Desconocido';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start',
      paddingHorizontal: ph, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    }}>
      {/* FECHA — clicable */}
      <TouchableOpacity
        onPress={() => setModalMode('info')}
        style={{ width: col.fecha }}
        activeOpacity={0.7}
      >
        <Text style={{
          fontSize: fs, color: '#2563eb',
          fontWeight: '600', textDecorationLine: 'underline',
        }} numberOfLines={1}>
          {formatFecha(tx.fecha)}
        </Text>
      </TouchableOpacity>

      {/* Modal único: info o edición — solo se monta cuando hace falta */}
      {modalMode !== 'none' && (
      <Modal
        visible
        transparent
        animationType={modalMode === 'edit' ? 'slide' : 'fade'}
        onRequestClose={() => setModalMode('none')}
      >
        {modalMode === 'info' ? (
          /* ── Vista info ── */
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 40 }}
            onPress={(e) => {
              // @ts-ignore — solo cierra si el click fue sobre el backdrop, no sobre un hijo
              if (e.target === e.currentTarget) setModalMode('none');
            }}
          >
            <View style={{
              backgroundColor: '#fff', borderRadius: 14, padding: 20,
              width: 260, gap: 10,
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
              <TouchableOpacity
                onPress={() => openEdit()}
                style={{ marginTop: 4, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563eb' }}>Editar movimiento</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        ) : (
          /* ── Vista edición ── */
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
              activeOpacity={1}
              onPress={() => setModalMode('none')}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <ScrollView
                  style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
                  contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 36 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>
                    Editar movimiento
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Salida ($)</Text>
                      <TextInput
                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#1e293b' }}
                        placeholder="0" placeholderTextColor="#94a3b8"
                        value={editDebe} onChangeText={setEditDebe} keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Entrada ($)</Text>
                      <TextInput
                        style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#1e293b' }}
                        placeholder="0" placeholderTextColor="#94a3b8"
                        value={editEntrega} onChangeText={setEditEntrega} keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <DateField
                    label="Fecha"
                    value={editFecha}
                    onChange={setEditFecha}
                    inputStyle={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
                    labelStyle={{ fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 }}
                  />
                  {variant === 'negocio' && (
                    <View>
                      <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Tipo</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {[...TIPOS_FIJOS, ...negocioTipos.map(t => t.nombre).filter(n => !TIPOS_FIJOS.includes(n)), 'Personalizado'].map((t) => {
                          const active = editTipo === t;
                          return (
                            <TouchableOpacity
                              key={t}
                              onPress={() => { setEditTipo(active ? '' : t); if (t !== 'Personalizado') setEditCustom(''); }}
                              style={{
                                paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
                                borderColor: active ? '#dc2626' : '#e2e8f0',
                                backgroundColor: active ? '#fee2e2' : '#f8fafc',
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? '#dc2626' : '#64748b' }}>{t}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {editTipo === 'Personalizado' && (
                        <TextInput
                          style={{ marginTop: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1e293b' }}
                          placeholder="Nombre del tipo de gasto" placeholderTextColor="#94a3b8"
                          value={editCustom} onChangeText={setEditCustom} autoCapitalize="sentences"
                        />
                      )}
                    </View>
                  )}
                  <View>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 }}>Observaciones</Text>
                    <TextInput
                      style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#1e293b', minHeight: 60 }}
                      placeholder="Ej: pagó con tarjeta..." placeholderTextColor="#94a3b8"
                      value={editObs} onChangeText={setEditObs} multiline textAlignVertical="top"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => setModalMode('none')}
                      style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' }}
                    >
                      <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveEdit}
                      disabled={editSaving}
                      style={{ flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
                    >
                      {editSaving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar cambios</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </Modal>
      )}
      <AmountCell
        value={tx.debe > 0 ? '-$ ' + Math.floor(tx.debe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
        style={{ width: col.debe }}
      >
        <Text style={{
          fontSize: fs, textAlign: 'right',
          color: tx.debe > 0 ? '#ef4444' : '#cbd5e1',
          fontWeight: tx.debe > 0 ? '600' : '400',
        }} numberOfLines={1}>
          {tx.debe > 0 ? '-$ ' + Math.floor(tx.debe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
        </Text>
      </AmountCell>
      <AmountCell
        value={tx.entrega > 0 ? '+$ ' + Math.floor(tx.entrega).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
        style={{ width: col.entrega }}
      >
        <Text style={{
          fontSize: fs, textAlign: 'right',
          color: tx.entrega > 0 ? '#22c55e' : '#cbd5e1',
          fontWeight: tx.entrega > 0 ? '600' : '400',
        }} numberOfLines={1}>
          {tx.entrega > 0 ? '+$ ' + Math.floor(tx.entrega).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
        </Text>
      </AmountCell>
      <AmountCell
        value={formatSaldo(tx.saldo_acumulado)}
        style={{ width: col.saldo }}
      >
        <Text style={{
          fontSize: fs, textAlign: 'right', fontWeight: '700',
          color: tx.saldo_acumulado > 0 ? '#16a34a' : tx.saldo_acumulado < 0 ? '#ef4444' : '#64748b',
        }} numberOfLines={1}>
          {formatSaldo(tx.saldo_acumulado)}
        </Text>
      </AmountCell>
      {variant === 'negocio' && (
        <TouchableOpacity
          onPress={() => setModalMode('info')}
          style={{ width: col.tipo, paddingHorizontal: 4 }}
          activeOpacity={0.7}
        >
          <Text style={{
            fontSize: fs,
            color: tx.tipo ? '#2563eb' : '#cbd5e1',
            fontWeight: tx.tipo ? '600' : '400',
            textDecorationLine: tx.tipo ? 'underline' : 'none',
          }} numberOfLines={1}>
            {tx.tipo ?? '—'}
          </Text>
        </TouchableOpacity>
      )}
      <Text style={{ width: col.obs, fontSize: fs, color: '#94a3b8', paddingLeft: 8, flexWrap: 'wrap' }}>
        {tx.observaciones ?? '—'}
      </Text>
      <TouchableOpacity
        onPress={handleEliminar}
        disabled={loading}
        // @ts-ignore
        onMouseEnter={() => setHoverTrash(true)}
        onMouseLeave={() => setHoverTrash(false)}
        style={{
          width: col.trash, height: 22, borderRadius: 6,
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
  const saldo    = -(client.saldo ?? 0);
  const esAFavor = saldo > 0;
  const alDia    = saldo === 0;
  const saldoLabel = alDia ? 'Al día' : esAFavor ? 'A favor' : 'Pendiente de pago';
  const saldoColor = alDia ? '#64748b' : esAFavor ? '#16a34a' : '#ef4444';
  const ultimos5   = transactions.slice(0, 5);

  const defaultMensaje = alDia
    ? `Hola ${client.nombre}, le informamos que su cuenta está al día. ¡Muchas gracias!`
    : esAFavor
    ? `Hola ${client.nombre}, le informamos que tiene un saldo a favor de ${formatARS(Math.abs(saldo))}.`
    : `Hola ${client.nombre}, le recordamos que tiene un saldo pendiente de pago de ${formatARS(saldo)}. Estos son sus últimos movimientos:`;

  const telInicial = parseTelefono(client.telefono ?? '');
  const [nombre, setNombre]     = useState(client.nombre);
  const [mensaje, setMensaje]   = useState(defaultMensaje);
  const [codPais, setCodPais]   = useState(telInicial.codPais);
  const [codCiud, setCodCiud]   = useState(telInicial.codCiud);
  const [localTel, setLocalTel] = useState(telInicial.local);

  const numeroWA = combinaTel(codPais, codCiud, localTel);

  const handleEnviar = async () => {
    const movimientosTexto = ultimos5.map((t) => {
      const partes = [];
      if (t.debe    > 0) partes.push(`Salida: ${formatARS(t.debe)}`);
      if (t.entrega > 0) partes.push(`Entrada: ${formatARS(t.entrega)}`);
      if (t.observaciones) partes.push(t.observaciones);
      return `${formatFecha(t.fecha)} | ${partes.join(' | ')}`;
    }).join('\n');

    const texto = [
      mensaje,
      ultimos5.length > 0 && !alDia ? movimientosTexto : '',
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

                {/* Últimos 5 movimientos */}
                {ultimos5.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 }}>
                    <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                      Últimos movimientos
                    </Text>
                    {ultimos5.map((t) => (
                      <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text style={{ fontSize: 12, color: '#64748b', width: 70 }}>{formatFecha(t.fecha)}</Text>
                        {t.debe > 0    && <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Salida: {formatARS(t.debe)}</Text>}
                        {t.entrega > 0 && <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: '600' }}>Entrada: {formatARS(t.entrega)}</Text>}
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

export function ClienteDetalle({ client, variant = 'agencia' }: { client: Client; variant?: 'agencia' | 'negocio' }) {
  const { transactions, transactionsLoading, archivarCliente } = useAppStore();
  const { width: screenWidth } = useWindowDimensions();
  const isNarrow = screenWidth < 768;
  const [showForm, setShowForm]           = useState(false);
  const [showEditar, setShowEditar]       = useState(false);
  const [showEnviar, setShowEnviar]       = useState(false);
  const [hoverArchivar, setHoverArchivar] = useState(false);
  const [hoverEditar, setHoverEditar]     = useState(false);
  const [hoverEnviar, setHoverEnviar]     = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (fecha: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(fecha) ? next.delete(fecha) : next.add(fecha);
      return next;
    });
  };

  const saldo    = -(client.saldo ?? 0); // positivo = más entradas, negativo = más salidas
  const esAFavor = saldo > 0;
  const alDia    = saldo === 0;

  const theme = variant === 'negocio'
    ? { headerBg: '#fff5f5', borderColor: '#fecaca', btnBg: '#dc2626', btnHover: '#fee2e2' }
    : { headerBg: '#fff',    borderColor: '#e2e8f0', btnBg: '#2563eb', btnHover: '#eff6ff' };

  const col = useColWidths(variant);
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
        backgroundColor: theme.headerBg, paddingHorizontal: 28, paddingVertical: 20,
        borderBottomWidth: 1, borderBottomColor: theme.borderColor,
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
            {!client.es_caja && !client.es_caja_negocio && client.activo && (
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
                backgroundColor: theme.btnBg, paddingHorizontal: 14, paddingVertical: 9,
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
            value={alDia ? '—' : formatSaldo(saldo)}
            color={alDia ? '#64748b' : saldo > 0 ? '#16a34a' : '#ef4444'}
            bold
          />
          {variant !== 'negocio' && <>
            <KPI label="Última salida"
              value={ultimoDebe ? '-$ ' + Math.floor(ultimoDebe.debe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'} color="#ef4444" />
            <KPI label="Última entrada"
              value={ultimaEntrega ? '+$ ' + Math.floor(ultimaEntrega.entrega).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'} color="#16a34a" />
          </>}
        </View>
      </View>

      {/* Tabla */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ minWidth: MIN_TABLE_WIDTH, flex: 1 }}>
        <View style={{ minWidth: MIN_TABLE_WIDTH, flex: 1 }}>
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
          <>
            {/* Encabezado fijo — fuera del scroll vertical */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: isNarrow ? 8 : 28, paddingVertical: 8,
              borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f1f5f9',
            }}>
              <Text style={{ width: col.fecha, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>FECHA</Text>
              <Text style={{ width: col.debe, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>{'SALIDA\nDINERO'}</Text>
              <Text style={{ width: col.entrega, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>{'ENTRADA\nDINERO'}</Text>
              <Text style={{ width: col.saldo, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>SALDO</Text>
              {variant === 'negocio' && (
                <Text style={{ width: col.tipo, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>TIPO</Text>
              )}
              <Text style={{ width: col.obs, fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', paddingLeft: 4 }}>OBSERVACIONES</Text>
              <View style={{ width: col.trash }} />
            </View>

            {/* Filas — scroll vertical independiente */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} nestedScrollEnabled>
            {variant !== 'negocio' && txsConSaldo.map((tx) => (
              <FilaTransaccion key={tx.id} tx={tx} clientId={client.id} variant={variant} />
            ))}
            {variant === 'negocio' && (() => {
              const hoy = todayISO();
              // Agrupar por fecha manteniendo orden descendente
              const grupos: Record<string, TransactionWithSaldo[]> = {};
              for (const tx of txsConSaldo) {
                if (!grupos[tx.fecha]) grupos[tx.fecha] = [];
                grupos[tx.fecha].push(tx);
              }
              const fechas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
              const fs = isNarrow ? 11 : 13;
              const ph = isNarrow ? 8 : 28;

              return fechas.map((fecha) => {
                const txsDia   = grupos[fecha];
                const esHoy    = fecha === hoy;
                const expandido = esHoy || expandedDates.has(fecha);

                if (esHoy) {
                  return txsDia.map(tx => (
                    <FilaTransaccion key={tx.id} tx={tx} clientId={client.id} variant={variant} />
                  ));
                }

                // Fila resumen del día
                const totalDebe    = txsDia.reduce((s, t) => s + t.debe, 0);
                const totalEntrega = txsDia.reduce((s, t) => s + t.entrega, 0);
                const saldoCierre  = txsDia[0].saldo_acumulado;
                const count        = txsDia.length;

                return (
                  <View key={fecha}>
                    {/* Fila colapsable */}
                    <TouchableOpacity
                      onPress={() => toggleDate(fecha)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: ph, paddingVertical: 9,
                        backgroundColor: expandido ? '#f8fafc' : '#f1f5f9',
                        borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
                      }}
                    >
                      <Text style={{ width: 14, fontSize: 10, color: '#94a3b8', marginRight: 4 }}>
                        {expandido ? '▼' : '▶'}
                      </Text>
                      <Text style={{ width: col.fecha - 18, fontSize: fs, color: '#475569', fontWeight: '600' }} numberOfLines={1}>
                        {formatFecha(fecha)}
                      </Text>
                      <AmountCell
                        value={totalDebe > 0 ? '-$ ' + Math.floor(totalDebe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
                        style={{ width: col.debe }}
                      >
                        <Text style={{
                          fontSize: fs, textAlign: 'right',
                          color: totalDebe > 0 ? '#ef4444' : '#cbd5e1',
                          fontWeight: totalDebe > 0 ? '600' : '400',
                        }}>
                          {totalDebe > 0 ? '-$ ' + Math.floor(totalDebe).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
                        </Text>
                      </AmountCell>
                      <AmountCell
                        value={totalEntrega > 0 ? '+$ ' + Math.floor(totalEntrega).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
                        style={{ width: col.entrega }}
                      >
                        <Text style={{
                          fontSize: fs, textAlign: 'right',
                          color: totalEntrega > 0 ? '#22c55e' : '#cbd5e1',
                          fontWeight: totalEntrega > 0 ? '600' : '400',
                        }}>
                          {totalEntrega > 0 ? '+$ ' + Math.floor(totalEntrega).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'}
                        </Text>
                      </AmountCell>
                      <AmountCell
                        value={formatSaldo(saldoCierre)}
                        style={{ width: col.saldo }}
                      >
                        <Text style={{
                          fontSize: fs, textAlign: 'right', fontWeight: '700',
                          color: saldoCierre > 0 ? '#16a34a' : saldoCierre < 0 ? '#ef4444' : '#64748b',
                        }}>
                          {formatSaldo(saldoCierre)}
                        </Text>
                      </AmountCell>
                      <View style={{ width: col.tipo }} />
                      <Text style={{ width: col.obs, fontSize: fs - 1, color: '#94a3b8', paddingLeft: 8 }}>
                        {count} mov.
                      </Text>
                      <View style={{ width: col.trash }} />
                    </TouchableOpacity>

                    {/* Filas individuales expandidas */}
                    {expandido && txsDia.map(tx => (
                      <View key={tx.id} style={{ backgroundColor: '#fafafa', borderLeftWidth: 3, borderLeftColor: '#e2e8f0' }}>
                        <FilaTransaccion tx={tx} clientId={client.id} variant={variant} />
                      </View>
                    ))}
                  </View>
                );
              });
            })()}
            </ScrollView>
          </>
        )}
        </View>
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
            <MovimientoForm clientId={client.id} variant={variant} currentSaldo={saldo} onClose={() => setShowForm(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
