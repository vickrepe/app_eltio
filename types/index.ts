export type UserRole = 'owner' | 'employee';

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
  fecha: string; // ISO date YYYY-MM-DD
  creado_por: string;
  created_at: string;
  anulada: boolean;
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
