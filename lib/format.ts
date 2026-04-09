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
