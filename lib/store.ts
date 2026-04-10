import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from './supabase';
import type { Client, Organization, Profile, Transaction } from '../types';

interface AppState {
  // Auth
  session:      Session | null;
  user:         User | null;
  profile:      Profile | null;
  organization: Organization | null;
  authLoading:  boolean;

  // Clientes
  clients:        Client[];
  clientsLoading: boolean;
  selectedClientId: string | null;
  cajaClient: Client | null;

  // Transacciones del cliente seleccionado
  transactions:        Transaction[];
  transactionsLoading: boolean;

  // Acciones de auth
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  // Acciones de clientes
  loadClients: () => Promise<void>;
  loadCaja: () => Promise<void>;
  selectClient: (clientId: string | null) => void;
  createClient: (data: { nombre: string; telefono: string; notas: string }) => Promise<string | null>;

  // Acciones de transacciones
  loadTransactions: (clientId: string) => Promise<void>;
  createTransaction: (data: {
    client_id: string;
    debe: number;
    entrega: number;
    observaciones: string;
    fecha: string;
  }) => Promise<string | null>;
  cancelarTransaccion: (transactionId: string, clientId: string) => Promise<string | null>;

  // Acciones de clientes
  archivarCliente: (clientId: string) => Promise<string | null>;
  updateClient: (clientId: string, data: { nombre: string; telefono: string; notas: string }) => Promise<string | null>;

  // Usuarios
  inviteUser: (data: { email: string; nombre: string; rol: string }) => Promise<string | null>;
}

export const useAppStore = create<AppState>((set, get) => ({
  session:          null,
  user:             null,
  profile:          null,
  organization:     null,
  authLoading:      true,
  clients:          [],
  clientsLoading:   false,
  selectedClientId: null,
  cajaClient:       null,
  transactions:        [],
  transactionsLoading: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, authLoading: false });
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) return;
    set({ profile });

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.org_id)
      .single();

    if (org) set({ organization: org });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null, user: null, profile: null,
      organization: null, clients: [], selectedClientId: null,
    });
  },

  loadClients: async () => {
    const { organization } = get();
    if (!organization) return;
    set({ clientsLoading: true });

    const { data, error } = await supabase
      .from('clients_with_balance')
      .select('*')
      .eq('org_id', organization.id)
      .eq('activo', true)
      .eq('es_caja', false)
      .order('nombre');

    if (!error && data) set({ clients: data as Client[] });
    set({ clientsLoading: false });
  },

  loadCaja: async () => {
    const { organization } = get();
    if (!organization) return;

    const { data } = await supabase
      .from('clients_with_balance')
      .select('*')
      .eq('org_id', organization.id)
      .eq('es_caja', true)
      .single();

    if (data) set({ cajaClient: data as Client });
  },

  selectClient: (clientId) => {
    set({ selectedClientId: clientId, transactions: [] });
    if (clientId) get().loadTransactions(clientId);
  },

  createClient: async ({ nombre, telefono, notas }) => {
    const { organization } = get();
    if (!organization) return 'No hay organización activa';

    const { error } = await supabase.from('clients').insert({
      org_id:   organization.id,
      nombre:   nombre.trim(),
      telefono: telefono.trim() || null,
      notas:    notas.trim() || null,
      activo:   true,
    });

    if (error) return error.message;
    await get().loadClients();
    return null;
  },

  loadTransactions: async (clientId) => {
    set({ transactionsLoading: true });

    const { data, error } = await supabase
      .from('transactions')
      .select('*, profiles!creado_por(nombre)')
      .eq('client_id', clientId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      const flat = data.map((t: any) => ({
        ...t,
        creado_por_nombre: t.profiles?.nombre ?? 'Desconocido',
        profiles: undefined,
      }));
      set({ transactions: flat as Transaction[] });
    }
    set({ transactionsLoading: false });
  },

  createTransaction: async ({ client_id, debe, entrega, observaciones, fecha }) => {
    const { organization, profile } = get();
    if (!organization || !profile) return 'Sesión inválida';

    const { error } = await supabase.from('transactions').insert({
      client_id,
      org_id:       organization.id,
      debe,
      entrega,
      observaciones: observaciones.trim() || null,
      fecha,
      creado_por:   profile.id,
    });

    if (error) return error.message;
    const isCaja = get().cajaClient?.id === client_id;
    await Promise.all([
      isCaja ? get().loadCaja() : get().loadClients(),
      get().loadTransactions(client_id),
    ]);
    return null;
  },

  cancelarTransaccion: async (transactionId, clientId) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) return error.message;
    const isCaja = get().cajaClient?.id === clientId;
    await Promise.all([
      isCaja ? get().loadCaja() : get().loadClients(),
      get().loadTransactions(clientId),
    ]);
    return null;
  },

  archivarCliente: async (clientId) => {
    const { error } = await supabase
      .from('clients')
      .update({ activo: false })
      .eq('id', clientId);

    if (error) return error.message;
    await get().loadClients();
    set({ selectedClientId: null, transactions: [] });
    return null;
  },

  inviteUser: async ({ email, nombre, rol }) => {
    const { error } = await supabase.functions.invoke('invite-user', {
      body: { email, nombre, rol },
    });
    if (error) return error.message;
    return null;
  },

  updateClient: async (clientId, { nombre, telefono, notas }) => {
    const { error } = await supabase
      .from('clients')
      .update({
        nombre:   nombre.trim(),
        telefono: telefono.trim() || null,
        notas:    notas.trim()    || null,
      })
      .eq('id', clientId);

    if (error) return error.message;
    await get().loadClients();
    return null;
  },
}));
