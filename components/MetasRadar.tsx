import { View, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import type { Meta, MetaRegistro } from '../types';

// ── helpers de fecha ──────────────────────────────────────────

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Cantidad de días entre dos fechas YYYY-MM-DD (inclusivo)
function daysBetweenInclusive(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  if (b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

// ── cálculo de cumplimiento por meta ──────────────────────────

export interface MetaPct {
  meta: Meta;
  pct: number;          // 0..1
  diasCumplidos: number;
  diasTotales: number;
}

export function computeMetaPcts(metas: Meta[], registros: MetaRegistro[]): MetaPct[] {
  const yesterday = yesterdayStr();

  // Mapa de cumplimiento: "metaId:fecha" -> cumplida
  const regMap = new Map<string, boolean>();
  for (const r of registros) regMap.set(`${r.meta_id}:${r.fecha}`, r.cumplida);

  return metas
    .filter(m => m.activo)
    .map(m => {
      const creada = m.created_at.slice(0, 10);
      // Contamos hasta AYER (días "cerrados"); el día en curso no penaliza.
      // Si la meta se creó hoy (o más tarde que ayer), todavía no hay días
      // cerrados y diasTotales queda en 0 => se muestra 100%.
      const fin = yesterday;
      const diasTotales = creada > fin ? 0 : daysBetweenInclusive(creada, fin);

      let diasCumplidos = 0;
      if (diasTotales > 0) {
        // recorrer cada día del rango [creada, fin]
        let cur = creada;
        for (let i = 0; i < diasTotales; i++) {
          if (regMap.get(`${m.id}:${cur}`)) diasCumplidos++;
          const [y, mo, d] = cur.split('-').map(Number);
          const next = new Date(y, mo - 1, d + 1);
          const yr = next.getFullYear();
          const month = String(next.getMonth() + 1).padStart(2, '0');
          const day = String(next.getDate()).padStart(2, '0');
          cur = `${yr}-${month}-${day}`;
        }
      }

      const pct = diasTotales > 0 ? diasCumplidos / diasTotales : 1;
      return { meta: m, pct, diasCumplidos, diasTotales };
    });
}

// ── componente radar ──────────────────────────────────────────

const SIZE   = 260;
const CENTER = SIZE / 2;
const RADIUS = 96;          // radio máximo (100%)
const RINGS  = [0.25, 0.5, 0.75, 1];

function polar(angle: number, r: number): { x: number; y: number } {
  // angle en radianes, 0 = arriba, sentido horario
  return {
    x: CENTER + r * Math.sin(angle),
    y: CENTER - r * Math.cos(angle),
  };
}

// Recorta una etiqueta larga
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function MetasRadar({ data }: { data: MetaPct[] }) {
  const n = data.length;
  if (n < 3) return null;

  const step = (2 * Math.PI) / n;

  // Vértices del polígono de datos
  const dataPoints = data.map((d, i) => {
    const angle = i * step;
    const p = polar(angle, RADIUS * Math.max(0, Math.min(1, d.pct)));
    return `${p.x},${p.y}`;
  }).join(' ');

  // Anillos de guía (polígonos concéntricos)
  const ringPolys = RINGS.map(frac =>
    data.map((_, i) => {
      const p = polar(i * step, RADIUS * frac);
      return `${p.x},${p.y}`;
    }).join(' ')
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={SIZE} height={SIZE}>
        {/* anillos de guía */}
        {ringPolys.map((pts, i) => (
          <Polygon
            key={`ring-${i}`}
            points={pts}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}

        {/* radios (ejes) */}
        {data.map((_, i) => {
          const p = polar(i * step, RADIUS);
          return (
            <Line
              key={`axis-${i}`}
              x1={CENTER} y1={CENTER}
              x2={p.x} y2={p.y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* polígono de datos */}
        <Polygon
          points={dataPoints}
          fill="rgba(37, 99, 235, 0.18)"
          stroke="#2563eb"
          strokeWidth={2}
        />

        {/* puntos en cada vértice */}
        {data.map((d, i) => {
          const p = polar(i * step, RADIUS * Math.max(0, Math.min(1, d.pct)));
          return (
            <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#2563eb" />
          );
        })}

        {/* etiquetas de cada meta */}
        {data.map((d, i) => {
          const angle = i * step;
          const p = polar(angle, RADIUS + 16);
          const sin = Math.sin(angle);
          const anchor = Math.abs(sin) < 0.1 ? 'middle' : sin > 0 ? 'start' : 'end';
          return (
            <SvgText
              key={`lbl-${i}`}
              x={p.x}
              y={p.y}
              fontSize={10}
              fontWeight="600"
              fill="#475569"
              textAnchor={anchor as any}
              alignmentBaseline="middle"
            >
              {truncate(d.meta.titulo, 12)}
            </SvgText>
          );
        })}
      </Svg>

      {/* leyenda con el % de cada meta */}
      <View style={{ width: '100%', marginTop: 8, gap: 6 }}>
        {data.map(d => {
          const pctTxt = Math.round(d.pct * 100);
          const color = pctTxt >= 80 ? '#16a34a' : pctTxt >= 50 ? '#ca8a04' : '#dc2626';
          return (
            <View key={d.meta.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 13, color: '#475569' }} numberOfLines={1}>
                {d.meta.titulo}
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>
                {d.diasCumplidos}/{d.diasTotales}d
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color }}>
                {pctTxt}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
