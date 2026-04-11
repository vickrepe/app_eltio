export type UserRole = 'owner' | 'owner_agencia' | 'employee' | 'owner_negocio' | 'empleado_negocio';

export interface Organization {
  id: string;
  nombre: string;
  owner_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  org_id: string;
  rol: UserRole;
  nombre: string;
  created_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  nombre: string;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  es_caja: boolean;
  es_caja_negocio: boolean;
  created_at: string;
  saldo?: number; // calculado: sum(debe) - sum(entrega). positivo = debe, negativo = a favor
}

export interface Transaction {
  id: string;
  client_id: string;
  org_id: string;
  debe: number;
  entrega: number;
  observaciones: string | null;
  tipo: string | null;
  fecha: string; // ISO date YYYY-MM-DD
  creado_por: string;
  creado_por_nombre?: string;
  created_at: string;
  anulada: boolean;
}

export interface NegocioTipo {
  id: string;
  org_id: string;
  nombre: string;
  created_at: string;
}

// Saldo acumulado por fila para mostrar en tabla
export interface TransactionWithSaldo extends Transaction {
  saldo_acumulado: number;
}

export interface NewClientForm {
  nombre: string;
  telefono: string;
  notas: string;
}

export interface NewTransactionForm {
  debe: string;
  entrega: string;
  observaciones: string;
  fecha: string;
}

export interface Meta {
  id: string;
  org_id: string;
  titulo: string;
  notas: string | null;
  puntuacion: number;
  activo: boolean;
  created_at: string;
}

export interface MetasConfig {
  id: string;
  org_id: string;
  puntos_iniciales: number;
  nombre_objetivo: string | null;
  puntos_objetivo: number | null;
  updated_at: string;
}

export interface MetaRegistro {
  id: string;
  meta_id: string;
  org_id: string;
  fecha: string; // YYYY-MM-DD
  cumplida: boolean;
  created_at: string;
}
