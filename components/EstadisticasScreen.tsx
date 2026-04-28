import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';
import { DateField } from './FichaCliente';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import type { Transaction } from '../types';

type Agrupacion = 'dia' | 'semana' | 'mes';

interface Props {
  variant: 'agencia' | 'negocio';
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

function groupKey(fecha: string, agrupacion: Agrupacion): string {
  if (agrupacion === 'dia')  return fecha;
  if (agrupacion === 'semana') return isoWeek(fecha);
  return fecha.slice(0, 7); // YYYY-MM
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function EstadisticasScreen({ variant }: Props) {
  const { cajaClient, cajaNegoClient, agenciaTipos, negocioTipos, loadAgenciaTipos, loadNegocioTipos, loadCaja, loadCajaNego } = useAppStore();

  const [txs, setTxs]             = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(false);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('mes');
  const [fechaDesde, setFechaDesde] = useState(monthAgo());
  const [fechaHasta, setFechaHasta] = useState(today());
  const [tipoFiltros, setTipoFiltros] = useState<Set<string>>(new Set());

  const cajaId = variant === 'agencia' ? cajaClient?.id : cajaNegoClient?.id;

  useEffect(() => {
    if (variant === 'agencia') {
      loadAgenciaTipos();
      if (!cajaClient) loadCaja();
    } else {
      loadNegocioTipos();
      if (!cajaNegoClient) loadCajaNego();
    }
  }, [variant]);

  useEffect(() => {
    if (!cajaId) return;
    setLoading(true);
    supabase
      .from('transactions')
      .select('*')
      .eq('client_id', cajaId)
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        if (data) setTxs(data as Transaction[]);
        setLoading(false);
      });
  }, [cajaId, fechaDesde, fechaHasta]);

  const TIPOS_FIJOS = ['Ventas', 'Empleados', 'Gastos Casa', 'Proveedores'];

  const tipos = useMemo(() => {
    const predefinidos = variant === 'negocio'
      ? [...TIPOS_FIJOS, ...negocioTipos.map(t => t.nombre).filter(n => !TIPOS_FIJOS.includes(n))]
      : agenciaTipos.map(t => t.nombre);
    const deTransacciones = txs.map(t => t.tipo).filter(Boolean) as string[];
    const todos = new Set([...predefinidos, ...deTransacciones]);
    return Array.from(todos);
  }, [variant, negocioTipos, agenciaTipos, txs]);

  const filteredTxs = useMemo(() =>
    tipoFiltros.size === 0
      ? txs
      : txs.filter(t => tipoFiltros.has(t.tipo ?? '(Sin etiqueta)')),
    [txs, tipoFiltros]
  );

  // Stats por etiqueta
  const porEtiqueta = useMemo(() => {
    const map: Record<string, { debe: number; entrega: number }> = {};
    for (const t of filteredTxs) {
      const key = t.tipo || '(Sin etiqueta)';
      if (!map[key]) map[key] = { debe: 0, entrega: 0 };
      map[key].debe    += t.debe;
      map[key].entrega += t.entrega;
    }
    return Object.entries(map).sort((a, b) => (b[1].debe + b[1].entrega) - (a[1].debe + a[1].entrega));
  }, [filteredTxs]);

  // Stats por periodo (agrupado)
  const porPeriodo = useMemo(() => {
    const map: Record<string, { debe: number; entrega: number }> = {};
    for (const t of filteredTxs) {
      const key = groupKey(t.fecha, agrupacion);
      if (!map[key]) map[key] = { debe: 0, entrega: 0 };
      map[key].debe    += t.debe;
      map[key].entrega += t.entrega;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTxs, agrupacion]);

  const maxEtiqueta = Math.max(1, ...porEtiqueta.map(([, v]) => Math.max(v.debe, v.entrega)));
  const maxPeriodo  = Math.max(1, ...porPeriodo.map(([, v]) => Math.max(v.debe, v.entrega)));

  const totalDebe    = filteredTxs.reduce((s, t) => s + t.debe, 0);
  const totalEntrega = filteredTxs.reduce((s, t) => s + t.entrega, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ padding: 16 }}>

      {/* Filtros de fecha */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <DateField
            label="Desde"
            value={fechaDesde}
            onChange={setFechaDesde}
            inputStyle={styles.dateInput}
            labelStyle={styles.label}
          />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <DateField
            label="Hasta"
            value={fechaHasta}
            onChange={setFechaHasta}
            inputStyle={styles.dateInput}
            labelStyle={styles.label}
          />
        </View>
      </View>

      {/* Filtro por etiqueta */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Etiqueta</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
          <TouchableOpacity
            onPress={() => setTipoFiltros(new Set())}
            style={[styles.pill, tipoFiltros.size === 0 && styles.pillActive]}
          >
            <Text style={[styles.pillText, tipoFiltros.size === 0 && styles.pillActiveText]}>Todas</Text>
          </TouchableOpacity>
          {tipos.map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTipoFiltros(prev => {
                const next = new Set(prev);
                next.has(t) ? next.delete(t) : next.add(t);
                return next;
              })}
              style={[styles.pill, tipoFiltros.has(t) && styles.pillActive]}
            >
              <Text style={[styles.pillText, tipoFiltros.has(t) && styles.pillActiveText]}>{t}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setTipoFiltros(prev => {
              const next = new Set(prev);
              next.has('(Sin etiqueta)') ? next.delete('(Sin etiqueta)') : next.add('(Sin etiqueta)');
              return next;
            })}
            style={[styles.pill, tipoFiltros.has('(Sin etiqueta)') && styles.pillActive]}
          >
            <Text style={[styles.pillText, tipoFiltros.has('(Sin etiqueta)') && styles.pillActiveText]}>Sin etiqueta</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Resumen total */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Total salida</Text>
            <Text style={{ color: Colors.deuda, fontWeight: '700', fontSize: 18 }}>{fmt(totalDebe)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Total entrada</Text>
            <Text style={{ color: Colors.pago, fontWeight: '700', fontSize: 18 }}>{fmt(totalEntrega)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Balance</Text>
            <Text style={{
              color: totalEntrega - totalDebe >= 0 ? Colors.pago : Colors.deuda,
              fontWeight: '700', fontSize: 18
            }}>{fmt(totalEntrega - totalDebe)}</Text>
          </View>
        </View>
      </View>

      {loading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />}

      {!loading && (
        <>
          {/* Gráfico por etiqueta */}
          <Text style={styles.sectionTitle}>Por etiqueta</Text>
          <View style={styles.card}>
            {porEtiqueta.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>Sin datos</Text>
            ) : (
              porEtiqueta.map(([nombre, vals]) => (
                <View key={nombre} style={{ marginBottom: 12 }}>
                  <Text style={{ color: Colors.text, fontSize: 13, marginBottom: 4, fontWeight: '500' }}>{nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                        <View style={{
                          height: 14,
                          width: `${Math.max(2, (vals.debe / maxEtiqueta) * 100)}%` as any,
                          backgroundColor: Colors.deuda,
                          borderRadius: 3,
                          marginRight: 6,
                        }} />
                        <Text style={{ color: Colors.deuda, fontSize: 11 }}>{fmt(vals.debe)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          height: 14,
                          width: `${Math.max(2, (vals.entrega / maxEtiqueta) * 100)}%` as any,
                          backgroundColor: Colors.pago,
                          borderRadius: 3,
                          marginRight: 6,
                        }} />
                        <Text style={{ color: Colors.pago, fontSize: 11 }}>{fmt(vals.entrega)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: Colors.deuda, borderRadius: 2 }} />
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Salida</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 12, height: 12, backgroundColor: Colors.pago, borderRadius: 2 }} />
                <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Entrada</Text>
              </View>
            </View>
          </View>

          {/* Agrupación temporal */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Evolución temporal</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['dia', 'semana', 'mes'] as Agrupacion[]).map(a => (
                <TouchableOpacity
                  key={a}
                  onPress={() => setAgrupacion(a)}
                  style={[styles.pill, agrupacion === a && styles.pillActive]}
                >
                  <Text style={[styles.pillText, agrupacion === a && styles.pillActiveText]}>
                    {a === 'dia' ? 'Día' : a === 'semana' ? 'Semana' : 'Mes'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.card}>
            {porPeriodo.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>Sin datos</Text>
            ) : (
              porPeriodo.map(([periodo, vals]) => (
                <View key={periodo} style={{ marginBottom: 12 }}>
                  <Text style={{ color: Colors.text, fontSize: 12, marginBottom: 4, fontWeight: '500' }}>{periodo}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                      <View style={{
                        height: 14,
                        width: `${Math.max(2, (vals.debe / maxPeriodo) * 100)}%` as any,
                        backgroundColor: Colors.deuda,
                        borderRadius: 3,
                        marginRight: 6,
                      }} />
                      <Text style={{ color: Colors.deuda, fontSize: 11 }}>{fmt(vals.debe)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        height: 14,
                        width: `${Math.max(2, (vals.entrega / maxPeriodo) * 100)}%` as any,
                        backgroundColor: Colors.pago,
                        borderRadius: 3,
                        marginRight: 6,
                      }} />
                      <Text style={{ color: Colors.pago, fontSize: 11 }}>{fmt(vals.entrega)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = {
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  pillActiveText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
};
