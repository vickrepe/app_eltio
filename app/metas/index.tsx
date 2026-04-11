import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';
import type { Meta } from '../../types';

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

// ── main screen ───────────────────────────────────────────────

export default function MetasScreen() {
  const router = useRouter();
  const {
    profile,
    metas, metasLoading, metaRegistros,
    loadMetas, createMeta, updateMeta, archivarMeta,
    loadMetaRegistros, toggleMetaRegistro,
  } = useAppStore();

  // Redirect non-owners
  useEffect(() => {
    if (profile && profile.rol !== 'owner') {
      router.replace('/(app)');
    }
  }, [profile]);

  const today     = todayStr();
  const startDate = subtractDays(today, 29);
  const days      = generateDays(startDate, today);

  const [expandedDays, setExpandedDays]   = useState<Set<string>>(new Set([today]));
  const [showGestionar, setShowGestionar] = useState(false);
  const [editingMeta, setEditingMeta]     = useState<Meta | null>(null);
  const [showForm, setShowForm]           = useState(false);

  // form
  const [titulo, setTitulo]         = useState('');
  const [notas, setNotas]           = useState('');
  const [puntuacion, setPuntuacion] = useState('1');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  useEffect(() => {
    loadMetas();
    loadMetaRegistros(startDate, today);
  }, []);

  const toggleDay = (fecha: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha); else next.add(fecha);
      return next;
    });
  };

  // Lookup: "metaId:fecha" → registro
  const registroMap = new Map<string, { cumplida: boolean }>();
  for (const r of metaRegistros) {
    registroMap.set(`${r.meta_id}:${r.fecha}`, { cumplida: r.cumplida });
  }

  function getDayScore(fecha: string): number {
    return metas
      .filter(m => m.activo && m.created_at.slice(0, 10) <= fecha)
      .reduce((sum, m) => {
        const reg = registroMap.get(`${m.id}:${fecha}`);
        const cumplida = reg?.cumplida ?? false;
        return sum + (cumplida ? m.puntuacion : -m.puntuacion);
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
    if (!titulo.trim())      { setFormError('El título es obligatorio'); return; }
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>

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
                      style={{
                        paddingHorizontal: 8, paddingVertical: 5,
                        borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 6,
                      }}
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

                {/* Formulario crear / editar */}
                {showForm ? (
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
                      {editingMeta ? 'Editar meta' : 'Nueva meta'}
                    </Text>
                    <View>
                      <Text style={labelStyle}>Título</Text>
                      <TextInput
                        style={inputStyle}
                        placeholder="Ej: Hacer ejercicio"
                        placeholderTextColor="#94a3b8"
                        value={titulo}
                        onChangeText={setTitulo}
                        autoCapitalize="sentences"
                      />
                    </View>
                    <View>
                      <Text style={labelStyle}>Notas (opcional)</Text>
                      <TextInput
                        style={{ ...inputStyle, minHeight: 60, textAlignVertical: 'top' }}
                        placeholder="Descripción o detalle..."
                        placeholderTextColor="#94a3b8"
                        value={notas}
                        onChangeText={setNotas}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                    <View>
                      <Text style={labelStyle}>Puntuación</Text>
                      <TextInput
                        style={{ ...inputStyle, width: 100 }}
                        placeholder="1"
                        placeholderTextColor="#94a3b8"
                        value={puntuacion}
                        onChangeText={setPuntuacion}
                        keyboardType="number-pad"
                      />
                    </View>
                    {formError && (
                      <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
                        <Text style={{ color: '#dc2626', fontSize: 13 }}>{formError}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        onPress={() => setShowForm(false)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 8,
                          alignItems: 'center', backgroundColor: '#f1f5f9',
                        }}
                      >
                        <Text style={{ color: '#475569', fontWeight: '500' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={formLoading}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 8,
                          alignItems: 'center', backgroundColor: '#2563eb',
                        }}
                      >
                        {formLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: '#fff', fontWeight: '600' }}>Guardar</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={openCreate}
                    style={{
                      marginTop: 12, backgroundColor: '#2563eb', borderRadius: 9,
                      paddingVertical: 10, alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Nueva meta</Text>
                  </TouchableOpacity>
                )}

                {/* Metas archivadas */}
                {archivedMetas.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Archivadas ({archivedMetas.length})
                    </Text>
                    {archivedMetas.map(m => (
                      <View key={m.id} style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 8, opacity: 0.55,
                      }}>
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
              backgroundColor: '#fff',
              borderRadius: 14,
              marginBottom: 8,
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 3,
              elevation: 1,
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
                        {/* Checkbox */}
                        <View style={{
                          width: 22, height: 22, borderRadius: 6,
                          borderWidth: 2,
                          borderColor: cumplida ? '#16a34a' : '#cbd5e1',
                          backgroundColor: cumplida ? '#16a34a' : '#fff',
                          alignItems: 'center', justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          {cumplida && (
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                          )}
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
                          <Text style={{
                            fontSize: 12, fontWeight: '600',
                            color: cumplida ? '#16a34a' : '#dc2626',
                          }}>
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
