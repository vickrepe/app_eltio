import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useAppStore } from '../lib/store';
import type { Meta, MetaFutura, MetaRegistro } from '../types';

// ── helpers ───────────────────────────────────────────────────

function confirmar(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg));
  return new Promise((resolve) => {
    Alert.alert('Confirmar', msg, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Aceptar', onPress: () => resolve(true) },
    ]);
  });
}

function formatFecha(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[d.getDay()]} ${day} de ${meses[month - 1]}`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function subtractDays(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d - n);
  const yr = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${yr}-${month}-${day}`;
}

function generateDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  let cur = endDate;
  while (cur >= startDate) {
    days.push(cur);
    const [y, mo, d] = cur.split('-').map(Number);
    const prev = new Date(y, mo - 1, d - 1);
    const yr = prev.getFullYear();
    const month = String(prev.getMonth() + 1).padStart(2, '0');
    const day = String(prev.getDate()).padStart(2, '0');
    cur = `${yr}-${month}-${day}`;
  }
  return days;
}

function computeTotalScore(
  metas: Meta[],
  allRegistros: MetaRegistro[],
  puntosIniciales: number,
): number {
  const activeMetas = metas.filter(m => m.activo);
  if (activeMetas.length === 0) return puntosIniciales;

  const earliest = activeMetas.reduce((min, m) => {
    const d = m.created_at.slice(0, 10);
    return d < min ? d : min;
  }, todayStr());

  const allDays = generateDays(earliest, todayStr());

  const regMap = new Map<string, boolean>();
  for (const r of allRegistros) {
    regMap.set(`${r.meta_id}:${r.fecha}`, r.cumplida);
  }

  let total = puntosIniciales;
  for (const fecha of allDays) {
    for (const m of activeMetas) {
      if (m.created_at.slice(0, 10) > fecha) continue;
      const cumplida = regMap.get(`${m.id}:${fecha}`) ?? false;
      total += cumplida ? m.puntuacion : -m.puntuacion;
    }
  }
  return total;
}

// ── styles ────────────────────────────────────────────────────

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: 16,
  marginBottom: 12,
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
  overflow: 'hidden' as const,
};

const inputStyle = {
  backgroundColor: '#f8fafc',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
  color: '#1e293b',
};

const labelStyle = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: '500' as const,
  marginBottom: 4,
};

// ── component ─────────────────────────────────────────────────

export default function MetasScreen() {
  const {
    metas, metasLoading, metaRegistros, metasConfig,
    loadMetas, createMeta, updateMeta, archivarMeta,
    loadMetaRegistros, loadAllMetaRegistros, toggleMetaRegistro,
    loadMetasConfig, saveMetasConfig,
    metasFuturas, metasFuturasLoading,
    loadMetasFuturas, createMetaFutura, updateMetaFutura,
    toggleMetaFuturaLograda, eliminarMetaFutura,
  } = useAppStore();

  const today     = todayStr();
  const startDate = subtractDays(today, 29);
  const days      = generateDays(startDate, today);

  const [expandedDays, setExpandedDays]   = useState<Set<string>>(new Set([today]));
  const [showGestionar, setShowGestionar] = useState(false);
  const [editingMeta, setEditingMeta]     = useState<Meta | null>(null);
  const [showForm, setShowForm]           = useState(false);

  // Metas Futuras
  const [showFuturas, setShowFuturas]           = useState(true);
  const [showFormFutura, setShowFormFutura]     = useState(false);
  const [editingFutura, setEditingFutura]       = useState<MetaFutura | null>(null);
  const [futuraTitulo, setFuturaTitulo]         = useState('');
  const [futuraNotas, setFuturaNotas]           = useState('');
  const [futuraLoading, setFuturaLoading]       = useState(false);
  const [futuraError, setFuturaError]           = useState<string | null>(null);

  // form metas
  const [titulo, setTitulo]           = useState('');
  const [notas, setNotas]             = useState('');
  const [puntuacion, setPuntuacion]   = useState('1');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);

  // Metas General
  const [showGeneral, setShowGeneral]       = useState(true);
  const [editandoGeneral, setEditandoGeneral] = useState(false);
  const [cfgNombre, setCfgNombre]           = useState('');
  const [cfgInicial, setCfgInicial]         = useState('778');
  const [cfgObjetivo, setCfgObjetivo]       = useState('');
  const [cfgLoading, setCfgLoading]         = useState(false);
  const [cfgError, setCfgError]             = useState<string | null>(null);

  useEffect(() => {
    loadMetas();
    loadAllMetaRegistros();
    loadMetasConfig();
    loadMetasFuturas();
  }, []);

  // Sincronizar formulario con config cargada
  useEffect(() => {
    if (metasConfig) {
      setCfgNombre(metasConfig.nombre_objetivo ?? '');
      setCfgInicial(String(metasConfig.puntos_iniciales));
      setCfgObjetivo(metasConfig.puntos_objetivo != null ? String(metasConfig.puntos_objetivo) : '');
    }
  }, [metasConfig]);

  const handleGuardarGeneral = async () => {
    const inicial  = parseInt(cfgInicial, 10);
    const objetivo = cfgObjetivo.trim() ? parseInt(cfgObjetivo, 10) : null;
    if (isNaN(inicial)) { setCfgError('El puntuaje inicial debe ser un número'); return; }
    if (objetivo !== null && isNaN(objetivo)) { setCfgError('El objetivo debe ser un número'); return; }
    setCfgLoading(true); setCfgError(null);
    const err = await saveMetasConfig({
      puntos_iniciales: inicial,
      nombre_objetivo:  cfgNombre,
      puntos_objetivo:  objetivo,
    });
    setCfgLoading(false);
    if (err) { setCfgError(err); return; }
    setEditandoGeneral(false);
  };

  // Puntuaje total acumulado
  const puntosIniciales = metasConfig?.puntos_iniciales ?? 0;
  const totalScore      = computeTotalScore(metas, metaRegistros, puntosIniciales);
  const objetivo        = metasConfig?.puntos_objetivo ?? null;
  const faltaPts        = objetivo != null ? objetivo - totalScore : null;
  const progresoPct     = objetivo != null && objetivo > 0
    ? Math.min(100, Math.max(0, Math.round((totalScore / objetivo) * 100)))
    : null;

  const toggleDay = (fecha: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha); else next.add(fecha);
      return next;
    });
  };

  const registroMap = new Map<string, { cumplida: boolean }>();
  for (const r of metaRegistros) {
    registroMap.set(`${r.meta_id}:${r.fecha}`, { cumplida: r.cumplida });
  }

  function getDayScore(fecha: string): number {
    return metas
      .filter(m => m.activo && m.created_at.slice(0, 10) <= fecha)
      .reduce((sum, m) => {
        const reg = registroMap.get(`${m.id}:${fecha}`);
        return sum + ((reg?.cumplida ?? false) ? m.puntuacion : -m.puntuacion);
      }, 0);
  }

  const handleToggle = async (metaId: string, fecha: string, current: boolean) => {
    await toggleMetaRegistro(metaId, fecha, !current);
  };

  const openCreate = () => {
    setEditingMeta(null);
    setTitulo(''); setNotas(''); setPuntuacion('1'); setFormError(null);
    setShowForm(true);
  };

  const openEdit = (m: Meta) => {
    setEditingMeta(m);
    setTitulo(m.titulo);
    setNotas(m.notas ?? '');
    setPuntuacion(String(m.puntuacion));
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const pts = parseInt(puntuacion, 10);
    if (!titulo.trim())        { setFormError('El título es obligatorio'); return; }
    if (isNaN(pts) || pts < 1) { setFormError('La puntuación debe ser un número positivo'); return; }
    setFormLoading(true); setFormError(null);
    const data = { titulo: titulo.trim(), notas: notas.trim(), puntuacion: pts };
    const err = editingMeta ? await updateMeta(editingMeta.id, data) : await createMeta(data);
    setFormLoading(false);
    if (err) { setFormError(err); return; }
    setShowForm(false);
  };

  const handleArchivar = async (m: Meta) => {
    const ok = await confirmar(`¿Archivar "${m.titulo}"? Ya no aparecerá en los registros futuros.`);
    if (!ok) return;
    await archivarMeta(m.id);
  };

  const activeMetas   = metas.filter(m => m.activo);
  const archivedMetas = metas.filter(m => !m.activo);

  const openCreateFutura = () => {
    setEditingFutura(null);
    setFuturaTitulo(''); setFuturaNotas(''); setFuturaError(null);
    setShowFormFutura(true);
  };

  const openEditFutura = (m: MetaFutura) => {
    setEditingFutura(m);
    setFuturaTitulo(m.titulo);
    setFuturaNotas(m.notas ?? '');
    setFuturaError(null);
    setShowFormFutura(true);
  };

  const handleSaveFutura = async () => {
    if (!futuraTitulo.trim()) { setFuturaError('El título es obligatorio'); return; }
    setFuturaLoading(true); setFuturaError(null);
    const data = { titulo: futuraTitulo.trim(), notas: futuraNotas.trim() };
    const err = editingFutura
      ? await updateMetaFutura(editingFutura.id, data)
      : await createMetaFutura(data);
    setFuturaLoading(false);
    if (err) { setFuturaError(err); return; }
    setShowFormFutura(false);
  };

  const handleEliminarFutura = async (m: MetaFutura) => {
    const ok = await confirmar(`¿Eliminar "${m.titulo}"?`);
    if (!ok) return;
    await eliminarMetaFutura(m.id);
  };

  const pendientesFuturas = metasFuturas.filter(m => !m.lograda);
  const logradasFuturas   = metasFuturas.filter(m => m.lograda);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>

      {/* ── Metas General ────────────────────────────────── */}
      <View style={cardStyle}>
        <TouchableOpacity
          onPress={() => setShowGeneral(!showGeneral)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
        >
          <Text style={{ fontSize: 16, marginRight: 10 }}>🏆</Text>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>
            {metasConfig?.nombre_objetivo ?? 'Metas General'}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14 }}>{showGeneral ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showGeneral && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 14 }} />

            {!editandoGeneral ? (
              <>
                {/* Puntuaje actual */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: totalScore >= 0 ? '#1e293b' : '#dc2626' }}>
                    {totalScore}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#64748b' }}>pts actuales</Text>
                </View>

                {objetivo != null && (
                  <>
                    {/* Barra de progreso */}
                    <View style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
                      <View style={{
                        height: 8, borderRadius: 4,
                        width: `${progresoPct}%` as any,
                        backgroundColor: faltaPts! <= 0 ? '#16a34a' : '#2563eb',
                      }} />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                        Objetivo: {objetivo} pts
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563eb' }}>
                        {progresoPct}%
                      </Text>
                    </View>

                    {faltaPts! > 0 ? (
                      <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 12 }}>
                        <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '500', textAlign: 'center' }}>
                          Te faltan{' '}
                          <Text style={{ fontWeight: '800' }}>{faltaPts}</Text>
                          {' '}pts para lograrlo
                        </Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#dcfce7', borderRadius: 10, padding: 12 }}>
                        <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700', textAlign: 'center' }}>
                          🎉 ¡Objetivo alcanzado!
                        </Text>
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity
                  onPress={() => setEditandoGeneral(true)}
                  style={{
                    marginTop: 14, borderRadius: 8, paddingVertical: 9, alignItems: 'center',
                    backgroundColor: '#f1f5f9',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#475569', fontWeight: '500' }}>
                    {metasConfig ? 'Editar objetivo' : 'Configurar objetivo'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Formulario edición */
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={labelStyle}>Nombre del objetivo</Text>
                  <TextInput style={inputStyle} placeholder="Ej: Meta 2025"
                    placeholderTextColor="#94a3b8" value={cfgNombre} onChangeText={setCfgNombre}
                    autoCapitalize="sentences" />
                </View>
                <View>
                  <Text style={labelStyle}>Puntuaje inicial</Text>
                  <TextInput style={{ ...inputStyle, width: 120 }} placeholder="0"
                    placeholderTextColor="#94a3b8" value={cfgInicial} onChangeText={setCfgInicial}
                    keyboardType="number-pad" />
                </View>
                <View>
                  <Text style={labelStyle}>Puntuaje objetivo</Text>
                  <TextInput style={{ ...inputStyle, width: 120 }} placeholder="Ej: 1000"
                    placeholderTextColor="#94a3b8" value={cfgObjetivo} onChangeText={setCfgObjetivo}
                    keyboardType="number-pad" />
                </View>
                {cfgError && (
                  <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
                    <Text style={{ color: '#dc2626', fontSize: 13 }}>{cfgError}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => { setEditandoGeneral(false); setCfgError(null); }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' }}
                  >
                    <Text style={{ color: '#475569', fontWeight: '500' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleGuardarGeneral}
                    disabled={cfgLoading}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563eb' }}
                  >
                    {cfgLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Gestionar Metas ──────────────────────────────── */}
      <View style={cardStyle}>
        <TouchableOpacity
          onPress={() => setShowGestionar(!showGestionar)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
        >
          <Text style={{ fontSize: 16, marginRight: 10 }}>⭐</Text>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>
            Gestionar Metas{activeMetas.length > 0 ? ` (${activeMetas.length})` : ''}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14 }}>{showGestionar ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showGestionar && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 }} />

            {metasLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <>
                {activeMetas.map(m => (
                  <View key={m.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                  }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>{m.titulo}</Text>
                      {m.notas ? (
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.notas}</Text>
                      ) : null}
                    </View>
                    <View style={{
                      backgroundColor: '#eff6ff', borderRadius: 20,
                      paddingHorizontal: 9, paddingVertical: 3, marginRight: 8,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb' }}>
                        {m.puntuacion} pts
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openEdit(m)}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 6 }}
                    >
                      <Text style={{ fontSize: 12, color: '#475569' }}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleArchivar(m)}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#fff7ed' }}
                    >
                      <Text style={{ fontSize: 12, color: '#ea580c' }}>Archivar</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {activeMetas.length === 0 && !showForm && (
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                    No hay metas activas. Creá una para empezar.
                  </Text>
                )}

                {showForm ? (
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                      {editingMeta ? 'Editar meta' : 'Nueva meta'}
                    </Text>
                    <View>
                      <Text style={labelStyle}>Título</Text>
                      <TextInput style={inputStyle} placeholder="Ej: Hacer ejercicio"
                        placeholderTextColor="#94a3b8" value={titulo} onChangeText={setTitulo}
                        autoCapitalize="sentences" />
                    </View>
                    <View>
                      <Text style={labelStyle}>Notas (opcional)</Text>
                      <TextInput
                        style={{ ...inputStyle, minHeight: 60, textAlignVertical: 'top' }}
                        placeholder="Descripción o detalle..."
                        placeholderTextColor="#94a3b8" value={notas} onChangeText={setNotas}
                        multiline numberOfLines={3} />
                    </View>
                    <View>
                      <Text style={labelStyle}>Puntuación</Text>
                      <TextInput style={{ ...inputStyle, width: 100 }} placeholder="1"
                        placeholderTextColor="#94a3b8" value={puntuacion} onChangeText={setPuntuacion}
                        keyboardType="number-pad" />
                    </View>
                    {formError && (
                      <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
                        <Text style={{ color: '#dc2626', fontSize: 13 }}>{formError}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity onPress={() => setShowForm(false)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' }}>
                        <Text style={{ color: '#475569', fontWeight: '500' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSave} disabled={formLoading}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563eb' }}>
                        {formLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openCreate} style={{
                    marginTop: 12, backgroundColor: '#2563eb', borderRadius: 9,
                    paddingVertical: 10, alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nueva meta</Text>
                  </TouchableOpacity>
                )}

                {archivedMetas.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Archivadas ({archivedMetas.length})
                    </Text>
                    {archivedMetas.map(m => (
                      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: 0.55 }}>
                        <Text style={{ flex: 1, fontSize: 13, color: '#64748b' }}>{m.titulo}</Text>
                        <Text style={{ fontSize: 12, color: '#94a3b8' }}>{m.puntuacion} pts</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Metas Futuras ────────────────────────────────── */}
      <View style={cardStyle}>
        <TouchableOpacity
          onPress={() => setShowFuturas(!showFuturas)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
        >
          <Text style={{ fontSize: 16, marginRight: 10 }}>🚀</Text>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>
            Metas Futuras{metasFuturas.length > 0 ? ` (${metasFuturas.length})` : ''}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14 }}>{showFuturas ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showFuturas && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 }} />

            {metasFuturasLoading ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <>
                {pendientesFuturas.map(m => (
                  <View key={m.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                  }}>
                    <TouchableOpacity
                      onPress={() => toggleMetaFuturaLograda(m.id, true)}
                      style={{
                        width: 22, height: 22, borderRadius: 11,
                        borderWidth: 2, borderColor: '#cbd5e1',
                        backgroundColor: '#fff', marginRight: 12,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    />
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>{m.titulo}</Text>
                      {m.notas ? (
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.notas}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => openEditFutura(m)}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 6 }}
                    >
                      <Text style={{ fontSize: 12, color: '#475569' }}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEliminarFutura(m)}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#fee2e2' }}
                    >
                      <Text style={{ fontSize: 12, color: '#dc2626' }}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {pendientesFuturas.length === 0 && !showFormFutura && (
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                    No hay metas futuras. ¡Anotá tus próximos sueños!
                  </Text>
                )}

                {showFormFutura ? (
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                      {editingFutura ? 'Editar meta futura' : 'Nueva meta futura'}
                    </Text>
                    <View>
                      <Text style={labelStyle}>Título</Text>
                      <TextInput style={inputStyle} placeholder="Ej: Viajar a Europa"
                        placeholderTextColor="#94a3b8" value={futuraTitulo} onChangeText={setFuturaTitulo}
                        autoCapitalize="sentences" />
                    </View>
                    <View>
                      <Text style={labelStyle}>Notas (opcional)</Text>
                      <TextInput
                        style={{ ...inputStyle, minHeight: 60, textAlignVertical: 'top' }}
                        placeholder="Detalles, contexto..."
                        placeholderTextColor="#94a3b8" value={futuraNotas} onChangeText={setFuturaNotas}
                        multiline numberOfLines={3} />
                    </View>
                    {futuraError && (
                      <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
                        <Text style={{ color: '#dc2626', fontSize: 13 }}>{futuraError}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity onPress={() => setShowFormFutura(false)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' }}>
                        <Text style={{ color: '#475569', fontWeight: '500' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleSaveFutura} disabled={futuraLoading}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563eb' }}>
                        {futuraLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openCreateFutura} style={{
                    marginTop: 12, backgroundColor: '#2563eb', borderRadius: 9,
                    paddingVertical: 10, alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nueva meta futura</Text>
                  </TouchableOpacity>
                )}

                {logradasFuturas.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Logradas ({logradasFuturas.length})
                    </Text>
                    {logradasFuturas.map(m => (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => toggleMetaFuturaLograda(m.id, false)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, opacity: 0.6 }}
                      >
                        <View style={{
                          width: 22, height: 22, borderRadius: 11,
                          backgroundColor: '#16a34a', marginRight: 12,
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 13, color: '#64748b', textDecorationLine: 'line-through' }}>
                          {m.titulo}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Registro diario ──────────────────────────────── */}
      {activeMetas.length === 0 && !metasLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Text style={{ fontSize: 32, marginBottom: 10 }}>🎯</Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '500' }}>Sin metas activas</Text>
          <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>
            Abrí "Gestionar Metas" para crear una.
          </Text>
        </View>
      ) : (
        days.map(fecha => {
          const metasDelDia = metas.filter(m => m.activo && m.created_at.slice(0, 10) <= fecha);
          if (metasDelDia.length === 0) return null;

          const score      = getDayScore(fecha);
          const isToday    = fecha === today;
          const expanded   = expandedDays.has(fecha);
          const scoreColor = score > 0 ? '#16a34a' : score < 0 ? '#dc2626' : '#64748b';

          return (
            <View key={fecha} style={{
              backgroundColor: '#fff', borderRadius: 14, marginBottom: 8,
              shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
              overflow: 'hidden',
              borderLeftWidth: isToday ? 3 : 0,
              borderLeftColor: '#2563eb',
            }}>
              <TouchableOpacity
                onPress={() => toggleDay(fecha)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 }}
              >
                <Text style={{
                  flex: 1, fontSize: 14,
                  fontWeight: isToday ? '700' : '600',
                  color: isToday ? '#2563eb' : '#1e293b',
                }}>
                  {isToday ? 'Hoy · ' : ''}{formatFecha(fecha)}
                </Text>
                <View style={{
                  backgroundColor: score > 0 ? '#dcfce7' : score < 0 ? '#fee2e2' : '#f1f5f9',
                  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginRight: 10,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: scoreColor }}>
                    {score > 0 ? '+' : ''}{score} pts
                  </Text>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>{expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 10 }} />
                  {metasDelDia.map(m => {
                    const reg      = registroMap.get(`${m.id}:${fecha}`);
                    const cumplida = reg?.cumplida ?? false;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => handleToggle(m.id, fecha, cumplida)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 9,
                          borderBottomWidth: 1, borderBottomColor: '#f8fafc',
                        }}
                      >
                        <View style={{
                          width: 22, height: 22, borderRadius: 6,
                          borderWidth: 2,
                          borderColor: cumplida ? '#16a34a' : '#cbd5e1',
                          backgroundColor: cumplida ? '#16a34a' : '#fff',
                          alignItems: 'center', justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          {cumplida && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                        </View>
                        <Text style={{
                          flex: 1, fontSize: 14,
                          color: cumplida ? '#16a34a' : '#475569',
                          fontWeight: cumplida ? '600' : '400',
                        }}>
                          {m.titulo}
                        </Text>
                        <View style={{
                          borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
                          backgroundColor: cumplida ? '#dcfce7' : '#fee2e2',
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: cumplida ? '#16a34a' : '#dc2626' }}>
                            {cumplida ? '+' : '−'}{m.puntuacion}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
