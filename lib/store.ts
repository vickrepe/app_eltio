import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from './supabase';
import type { AgenciaTipo, Client, Meta, MetaFutura, MetaRegistro, MetasConfig, NegocioTipo, Organization, Profile, Transaction } from '../types';

interface AppState {
  // Auth
  session:      Session | null;
  user:         User | null;
  profile:      Profile | null;
  organization: Organization | null;
  authLoading:  boolean;

  // Clientes
  clients:          Client[];
  clientsLoading:   boolean;
  selectedClientId: string | null;
  cajaClient:       Client | null;
  cajaNegoClient:   Client | null;
  archivedClients:  Client[];

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
  loadCajaNego: () => Promise<void>;
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
    tipo?: string;
  }) => Promise<string | null>;
  cancelarTransaccion:  (transactionId: string, clientId: string) => Promise<string | null>;
  updateTransaction:    (transactionId: string, clientId: string, data: {
    debe: number; entrega: number; observaciones: string; fecha: string; tipo?: string;
  }) => Promise<string | null>;

  // Acciones de clientes
  archivarCliente: (clientId: string) => Promise<string | null>;
  desarchivarCliente: (clientId: string) => Promise<string | null>;
  eliminarCliente: (clientId: string) => Promise<string | null>;
  loadArchivedClients: () => Promise<void>;
  updateClient: (clientId: string, data: { nombre: string; telefono: string; notas: string }) => Promise<string | null>;

  // Usuarios
  orgUsers: Profile[];
  loadOrgUsers: () => Promise<void>;
  inviteUser: (data: { email: string; nombre: string; rol: string }) => Promise<string | null>;
  updateUserRol: (profileId: string, rol: string) => Promise<string | null>;
  removeUser: (profileId: string) => Promise<string | null>;

  // Tipos personalizados negocio
  negocioTipos:      NegocioTipo[];
  loadNegocioTipos:  () => Promise<void>;
  saveNegocioTipo:   (nombre: string) => Promise<string | null>;

  // Tipos personalizados agencia
  agenciaTipos:      AgenciaTipo[];
  loadAgenciaTipos:  () => Promise<void>;
  saveAgenciaTipo:   (nombre: string) => Promise<string | null>;

  // Metas
  metas:              Meta[];
  metasLoading:       boolean;
  metaRegistros:      MetaRegistro[];
  metasConfig:        MetasConfig | null;
  loadMetas:          () => Promise<void>;
  createMeta:         (data: { titulo: string; notas: string; puntuacion: number }) => Promise<string | null>;
  updateMeta:         (metaId: string, data: { titulo: string; notas: string; puntuacion: number }) => Promise<string | null>;
  archivarMeta:       (metaId: string) => Promise<string | null>;
  loadMetaRegistros:  (startDate: string, endDate: string) => Promise<void>;
  loadAllMetaRegistros: () => Promise<void>;
  toggleMetaRegistro: (metaId: string, fecha: string, cumplida: boolean) => Promise<string | null>;
  loadMetasConfig:    () => Promise<void>;
  saveMetasConfig:    (data: { puntos_iniciales: number; nombre_objetivo: string; puntos_objetivo: number | null }) => Promise<string | null>;

  // Metas Futuras
  metasFuturas:          MetaFutura[];
  metasFuturasLoading:   boolean;
  loadMetasFuturas:      () => Promise<void>;
  createMetaFutura:      (data: { titulo: string; notas: string }) => Promise<string | null>;
  updateMetaFutura:      (id: string, data: { titulo: string; notas: string }) => Promise<string | null>;
  toggleMetaFuturaLograda: (id: string, lograda: boolean) => Promise<string | null>;
  eliminarMetaFutura:    (id: string) => Promise<string | null>;
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
  cajaNegoClient:   null,
  archivedClients:  [],
  transactions:        [],
  transactionsLoading: false,
  orgUsers:         [],
  negocioTipos:     [],
  agenciaTipos:     [],
  metas:            [],
  metasLoading:     false,
  metaRegistros:    [],
  metasConfig:      null,
  metasFuturas:        [],
  metasFuturasLoading: false,

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
      cajaClient: null, cajaNegoClient: null,
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
      .eq('es_caja_negocio', false)
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
      .limit(1)
      .maybeSingle();

    if (data) set({ cajaClient: data as Client });
  },

  loadCajaNego: async () => {
    const { organization } = get();
    if (!organization) return;

    const { data } = await supabase
      .from('clients_with_balance')
      .select('*')
      .eq('org_id', organization.id)
      .eq('es_caja_negocio', true)
      .limit(1)
      .maybeSingle();

    if (data) set({ cajaNegoClient: data as Client });
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

  createTransaction: async ({ client_id, debe, entrega, observaciones, fecha, tipo }) => {
    const { organization, profile } = get();
    if (!organization || !profile) return 'Sesión inválida';

    const { error } = await supabase.from('transactions').insert({
      client_id,
      org_id:       organization.id,
      debe,
      entrega,
      observaciones: observaciones.trim() || null,
      tipo:          tipo?.trim() || null,
      fecha,
      creado_por:   profile.id,
    });

    if (error) return error.message;
    const isCaja     = get().cajaClient?.id === client_id;
    const isCajaNego = get().cajaNegoClient?.id === client_id;
    await Promise.all([
      isCaja ? get().loadCaja() : isCajaNego ? get().loadCajaNego() : get().loadClients(),
      get().loadTransactions(client_id),
    ]);
    return null;
  },

  updateTransaction: async (transactionId, clientId, { debe, entrega, observaciones, fecha, tipo }) => {
    const { data: updated, error } = await supabase
      .from('transactions')
      .update({
        debe,
        entrega,
        observaciones: observaciones.trim() || null,
        fecha,
        tipo: tipo?.trim() || null,
      })
      .eq('id', transactionId)
      .select('id, debe, entrega');
    if (error) return error.message;
    if (!updated || updated.length === 0) return 'Sin permiso para editar (RLS).';
    const isCaja     = get().cajaClient?.id === clientId;
    const isCajaNego = get().cajaNegoClient?.id === clientId;
    await Promise.all([
      isCaja ? get().loadCaja() : isCajaNego ? get().loadCajaNego() : get().loadClients(),
      get().loadTransactions(clientId),
    ]);
    return null;
  },

  cancelarTransaccion: async (transactionId, clientId) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) return error.message;
    const isCaja     = get().cajaClient?.id === clientId;
    const isCajaNego = get().cajaNegoClient?.id === clientId;
    await Promise.all([
      isCaja ? get().loadCaja() : isCajaNego ? get().loadCajaNego() : get().loadClients(),
      get().loadTransactions(clientId),
    ]);
    return null;
  },

  loadArchivedClients: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('clients_with_balance')
      .select('*')
      .eq('org_id', organization.id)
      .eq('activo', false)
      .eq('es_caja', false)
      .order('nombre');
    if (data) set({ archivedClients: data as Client[] });
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

  desarchivarCliente: async (clientId) => {
    const { error } = await supabase
      .from('clients')
      .update({ activo: true })
      .eq('id', clientId);

    if (error) return error.message;
    await Promise.all([get().loadClients(), get().loadArchivedClients()]);
    return null;
  },

  eliminarCliente: async (clientId) => {
    // Las transacciones se eliminan por CASCADE en la FK, pero por si acaso las borramos primero
    await supabase.from('transactions').delete().eq('client_id', clientId);
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) return error.message;
    await get().loadArchivedClients();
    return null;
  },

  loadOrgUsers: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', organization.id)
      .order('nombre');
    if (data) set({ orgUsers: data as Profile[] });
  },

  inviteUser: async ({ email, nombre, rol }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'Sin sesión activa';

    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ email, nombre, rol }),
    });

    const body = await res.json();
    if (!res.ok) return body.error ?? `Error ${res.status}`;
    return null;
  },

  updateUserRol: async (profileId, rol) => {
    const { error } = await supabase
      .from('profiles')
      .update({ rol })
      .eq('id', profileId);
    if (error) return error.message;
    await get().loadOrgUsers();
    return null;
  },

  removeUser: async (profileId) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);
    if (error) return error.message;
    await get().loadOrgUsers();
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

  loadNegocioTipos: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('negocio_tipos')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at');
    if (data) set({ negocioTipos: data as NegocioTipo[] });
  },

  saveNegocioTipo: async (nombre) => {
    const { organization } = get();
    if (!organization) return 'Sin organización activa';
    const { error } = await supabase.from('negocio_tipos').insert({
      org_id: organization.id,
      nombre: nombre.trim(),
    });
    if (error) return error.message;
    await get().loadNegocioTipos();
    return null;
  },

  loadAgenciaTipos: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('agencia_tipos')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at');
    if (data) set({ agenciaTipos: data as AgenciaTipo[] });
  },

  saveAgenciaTipo: async (nombre) => {
    const { organization } = get();
    if (!organization) return 'Sin organización activa';
    const { error } = await supabase.from('agencia_tipos').insert({
      org_id: organization.id,
      nombre: nombre.trim(),
    });
    if (error) return error.message;
    await get().loadAgenciaTipos();
    return null;
  },

  loadMetas: async () => {
    const { organization } = get();
    if (!organization) return;
    set({ metasLoading: true });
    const { data } = await supabase
      .from('metas')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at');
    if (data) set({ metas: data as Meta[] });
    set({ metasLoading: false });
  },

  createMeta: async ({ titulo, notas, puntuacion }) => {
    const { organization } = get();
    if (!organization) return 'Sin organización activa';
    const { error } = await supabase.from('metas').insert({
      org_id: organization.id,
      titulo:     titulo.trim(),
      notas:      notas.trim() || null,
      puntuacion,
    });
    if (error) return error.message;
    await get().loadMetas();
    return null;
  },

  updateMeta: async (metaId, { titulo, notas, puntuacion }) => {
    const { error } = await supabase
      .from('metas')
      .update({ titulo: titulo.trim(), notas: notas.trim() || null, puntuacion })
      .eq('id', metaId);
    if (error) return error.message;
    await get().loadMetas();
    return null;
  },

  archivarMeta: async (metaId) => {
    const { error } = await supabase
      .from('metas')
      .update({ activo: false })
      .eq('id', metaId);
    if (error) return error.message;
    await get().loadMetas();
    return null;
  },

  loadMetaRegistros: async (startDate, endDate) => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('meta_registros')
      .select('*')
      .eq('org_id', organization.id)
      .gte('fecha', startDate)
      .lte('fecha', endDate);
    if (data) set({ metaRegistros: data as MetaRegistro[] });
  },

  loadAllMetaRegistros: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('meta_registros')
      .select('*')
      .eq('org_id', organization.id);
    if (data) set({ metaRegistros: data as MetaRegistro[] });
  },

  loadMetasConfig: async () => {
    const { organization } = get();
    if (!organization) return;
    const { data } = await supabase
      .from('metas_config')
      .select('*')
      .eq('org_id', organization.id)
      .maybeSingle();
    set({ metasConfig: data as MetasConfig | null });
  },

  saveMetasConfig: async ({ puntos_iniciales, nombre_objetivo, puntos_objetivo }) => {
    const { organization } = get();
    if (!organization) return 'Sin organización activa';
    const { error } = await supabase.from('metas_config').upsert(
      {
        org_id: organization.id,
        puntos_iniciales,
        nombre_objetivo: nombre_objetivo.trim() || null,
        puntos_objetivo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );
    if (error) return error.message;
    await get().loadMetasConfig();
    return null;
  },

  loadMetasFuturas: async () => {
    const { organization } = get();
    if (!organization) return;
    set({ metasFuturasLoading: true });
    const { data } = await supabase
      .from('metas_futuras')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at', { ascending: false });
    if (data) set({ metasFuturas: data as MetaFutura[] });
    set({ metasFuturasLoading: false });
  },

  createMetaFutura: async ({ titulo, notas }) => {
    const { organization } = get();
    if (!organization) return 'Sin organización activa';
    const { error } = await supabase.from('metas_futuras').insert({
      org_id: organization.id,
      titulo: titulo.trim(),
      notas:  notas.trim() || null,
    });
    if (error) return error.message;
    await get().loadMetasFuturas();
    return null;
  },

  updateMetaFutura: async (id, { titulo, notas }) => {
    const { error } = await supabase
      .from('metas_futuras')
      .update({ titulo: titulo.trim(), notas: notas.trim() || null })
      .eq('id', id);
    if (error) return error.message;
    await get().loadMetasFuturas();
    return null;
  },

  toggleMetaFuturaLograda: async (id, lograda) => {
    const { metasFuturas } = get();
    set({ metasFuturas: metasFuturas.map(m => m.id === id ? { ...m, lograda } : m) });
    const { error } = await supabase
      .from('metas_futuras')
      .update({ lograda })
      .eq('id', id);
    if (error) {
      set({ metasFuturas: metasFuturas });
      return error.message;
    }
    return null;
  },

  eliminarMetaFutura: async (id) => {
    const { error } = await supabase.from('metas_futuras').delete().eq('id', id);
    if (error) return error.message;
    await get().loadMetasFuturas();
    return null;
  },

  toggleMetaRegistro: async (metaId, fecha, cumplida) => {
    const { organization, metaRegistros } = get();
    if (!organization) return 'Sin organización activa';

    // Optimistic update
    const existing = metaRegistros.find(r => r.meta_id === metaId && r.fecha === fecha);
    if (existing) {
      set({ metaRegistros: metaRegistros.map(r =>
        r.meta_id === metaId && r.fecha === fecha ? { ...r, cumplida } : r
      )});
    } else {
      const optimistic: MetaRegistro = {
        id: `temp_${metaId}_${fecha}`,
        meta_id: metaId,
        org_id:  organization.id,
        fecha,
        cumplida,
        created_at: new Date().toISOString(),
      };
      set({ metaRegistros: [...metaRegistros, optimistic] });
    }

    const { error } = await supabase.from('meta_registros').upsert(
      { meta_id: metaId, org_id: organization.id, fecha, cumplida },
      { onConflict: 'meta_id,fecha' }
    );

    if (error) {
      // Revert optimistic update on failure
      if (existing) {
        set({ metaRegistros: metaRegistros.map(r =>
          r.meta_id === metaId && r.fecha === fecha ? existing : r
        )});
      } else {
        set({ metaRegistros: metaRegistros.filter(r => !(r.meta_id === metaId && r.fecha === fecha)) });
      }
      return error.message;
    }
    return null;
  },
}));
