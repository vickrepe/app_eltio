/** Formatea un número como pesos argentinos. Compatible con Hermes (Android). */
export function formatARS(n: number): string {
  const abs = Math.abs(n);
  const entero = Math.floor(abs);
  const formatted = entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
}

/** Convierte fecha ISO (YYYY-MM-DD) a formato DD/MM/YYYY */
export function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Fecha de hoy en formato ISO */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Extrae HH:MM de un timestamp ISO (created_at de Supabase) */
export function formatHora(iso: string): string {
  const date = new Date(iso);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
