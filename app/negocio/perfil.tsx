import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Alert, Platform,
  TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';

function confirmar(msg: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(msg));
  return new Promise((resolve) => {
    Alert.alert('Confirmar', msg, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Aceptar', onPress: () => resolve(true) },
    ]);
  });
}

const cardStyle = {
  backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
  shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  overflow: 'hidden' as const,
};

const ROL_LABEL: Record<string, string> = {
  owner_negocio:    'Dueño Negocio',
  empleado_negocio: 'Empleado Negocio',
};

// ─── Gestión usuarios negocio ────────────────────────────────

function GestionUsuarios({ myProfileId }: { myProfileId: string }) {
  const { orgUsers, loadOrgUsers, updateUserRol, removeUser } = useAppStore();
  const [expanded, setExpanded]   = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  useEffect(() => {
    if (expanded) loadOrgUsers();
  }, [expanded]);

  const handleCambiarRol = async (u: Profile) => {
    const nuevoRol = u.rol === 'owner_negocio' ? 'empleado_negocio' : 'owner_negocio';
    const ok = await confirmar(`¿Cambiar rol de ${u.nombre} a ${ROL_LABEL[nuevoRol]}?`);
    if (!ok) return;
    setLoadingId(u.id);
    const err = await updateUserRol(u.id, nuevoRol);
    setLoadingId(null);
    if (err) setErrorMsg(err);
  };

  const handleEliminar = async (u: Profile) => {
    const ok = await confirmar(`¿Eliminar a ${u.nombre}? Perderá acceso a la aplicación.`);
    if (!ok) return;
    setLoadingId(u.id);
    const err = await removeUser(u.id);
    setLoadingId(null);
    if (err) setErrorMsg(err);
  };

  return (
    <View style={cardStyle}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
      >
        <Text style={{ fontSize: 18, marginRight: 12 }}>👥</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>Usuarios</Text>
        <Text style={{ color: '#94a3b8', fontSize: 16 }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 }} />

          {errorMsg && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: '#dc2626', fontSize: 13 }}>{errorMsg}</Text>
            </View>
          )}

          {orgUsers.length === 0 ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            orgUsers.map((u) => {
              const isMe    = u.id === myProfileId;
              const isOwner = u.rol === 'owner_negocio';
              const busy    = loadingId === u.id;
              const label   = ROL_LABEL[u.rol] ?? u.rol;
              const color   = isOwner ? { bg: '#f0fdf4', text: '#16a34a' } : { bg: '#f1f5f9', text: '#64748b' };

              return (
                <View key={u.id} style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontWeight: '700', color: color.text }}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>
                      {u.nombre}{isMe ? ' (yo)' : ''}
                    </Text>
                    <View style={{
                      marginTop: 3, alignSelf: 'flex-start', borderRadius: 20,
                      paddingHorizontal: 8, paddingVertical: 2, backgroundColor: color.bg,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: color.text }}>{label}</Text>
                    </View>
                  </View>
                  {!isMe && (
                    busy ? (
                      <ActivityIndicator color="#2563eb" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleCambiarRol(u)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: '#f1f5f9' }}
                        >
                          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '500' }}>
                            {isOwner ? '→ Empleado' : '→ Dueño'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEliminar(u)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: '#fee2e2' }}
                        >
                          <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: '500' }}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ─── Invitar usuario negocio ─────────────────────────────────

function InvitarUsuario() {
  const { inviteUser } = useAppStore();
  const [email, setEmail]       = useState('');
  const [nombre, setNombre]     = useState('');
  const [rol, setRol]           = useState<'owner_negocio' | 'empleado_negocio'>('owner_negocio');
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleInvitar = async () => {
    setErrorMsg(null); setSuccessMsg(null);
    if (!email.trim() || !nombre.trim()) { setErrorMsg('Completá el nombre y el email'); return; }
    setLoading(true);
    const err = await inviteUser({ email: email.trim(), nombre: nombre.trim(), rol });
    setLoading(false);
    if (err) { setErrorMsg(err); return; }
    setSuccessMsg(`Invitación enviada a ${email.trim()}`);
    setEmail(''); setNombre(''); setRol('owner_negocio');
  };

  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1e293b',
  };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 };

  return (
    <View style={cardStyle}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
      >
        <Text style={{ fontSize: 18, marginRight: 12 }}>✉️</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>Invitar usuario</Text>
        <Text style={{ color: '#94a3b8', fontSize: 16 }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 4 }} />
          <View>
            <Text style={labelStyle}>Nombre</Text>
            <TextInput style={inputStyle} placeholder="Ej: María López"
              placeholderTextColor="#94a3b8" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
          </View>
          <View>
            <Text style={labelStyle}>Email</Text>
            <TextInput style={inputStyle} placeholder="correo@ejemplo.com"
              placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View>
            <Text style={labelStyle}>Rol</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['owner_negocio', 'empleado_negocio'] as const).map((r) => (
                <TouchableOpacity key={r} onPress={() => setRol(r)} style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: rol === r ? '#16a34a' : '#e2e8f0',
                  backgroundColor: rol === r ? '#f0fdf4' : '#f8fafc',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: rol === r ? '#16a34a' : '#94a3b8' }}>
                    {ROL_LABEL[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {errorMsg && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
              <Text style={{ color: '#dc2626', fontSize: 13 }}>{errorMsg}</Text>
            </View>
          )}
          {successMsg && (
            <View style={{ backgroundColor: '#dcfce7', borderRadius: 8, padding: 10 }}>
              <Text style={{ color: '#16a34a', fontSize: 13 }}>{successMsg}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleInvitar} disabled={loading} style={{
            backgroundColor: '#16a34a', borderRadius: 9,
            paddingVertical: 12, alignItems: 'center', marginTop: 4,
          }}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Enviar invitación</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Cambiar contraseña ──────────────────────────────────────

function CambiarContrasena() {
  const [expanded, setExpanded]     = useState(false);
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGuardar = async () => {
    setErrorMsg(null); setSuccessMsg(null);
    if (password.length < 6) { setErrorMsg('Mínimo 6 caracteres'); return; }
    if (password !== confirm)  { setErrorMsg('Las contraseñas no coinciden'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    setSuccessMsg('Contraseña actualizada correctamente');
    setPassword(''); setConfirm('');
  };

  const inputStyle = {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1e293b',
  };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: '500' as const, marginBottom: 4 };

  return (
    <View style={cardStyle}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
        <Text style={{ fontSize: 18, marginRight: 12 }}>🔑</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1e293b' }}>Cambiar contraseña</Text>
        <Text style={{ color: '#94a3b8', fontSize: 16 }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>
          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 4 }} />
          <View>
            <Text style={labelStyle}>Nueva contraseña</Text>
            <TextInput style={inputStyle} placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <View>
            <Text style={labelStyle}>Confirmar contraseña</Text>
            <TextInput style={inputStyle} placeholder="Repetí la contraseña"
              placeholderTextColor="#94a3b8" value={confirm} onChangeText={setConfirm} secureTextEntry />
          </View>
          {errorMsg && (
            <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10 }}>
              <Text style={{ color: '#dc2626', fontSize: 13 }}>{errorMsg}</Text>
            </View>
          )}
          {successMsg && (
            <View style={{ backgroundColor: '#dcfce7', borderRadius: 8, padding: 10 }}>
              <Text style={{ color: '#16a34a', fontSize: 13 }}>{successMsg}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handleGuardar} disabled={loading} style={{
            backgroundColor: '#2563eb', borderRadius: 9, paddingVertical: 12, alignItems: 'center', marginTop: 4,
          }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Guardar contraseña</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────

export default function NegocioPerfilScreen() {
  const { profile, organization, signOut } = useAppStore();
  const router = useRouter();
  const isOwnerNegocio = profile?.rol === 'owner_negocio';
  const isSuperOwner   = profile?.rol === 'owner';
  const rolLabel = ROL_LABEL[profile?.rol ?? ''] ?? profile?.rol ?? '—';

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro que querés cerrar sesión?')) signOut();
    } else {
      Alert.alert('Cerrar sesión', '¿Estás seguro?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 20 }}>

      {/* Botones de acceso rápido — solo owner super */}
      {isSuperOwner && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)')}
            style={{
              flex: 1, backgroundColor: '#eff6ff', borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>↩️</Text>
            <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 14 }}>Ir a Agencia</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/negocio/metas')}
            style={{
              flex: 1, backgroundColor: '#fefce8', borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>🎯</Text>
            <Text style={{ color: '#ca8a04', fontWeight: '600', fontSize: 14 }}>Metas</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Card de usuario */}
      <View style={{ ...cardStyle, padding: 20, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginRight: 14,
          }}>
            <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 20 }}>
              {profile?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#1e293b' }}>{profile?.nombre ?? '—'}</Text>
            <View style={{
              marginTop: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2,
              alignSelf: 'flex-start', backgroundColor: '#f0fdf4',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#16a34a' }}>{rolLabel}</Text>
            </View>
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 }}>
          <Text style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
            Negocio
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#1e293b' }}>{organization?.nombre ?? '—'}</Text>
        </View>
      </View>

      {/* Gestión de usuarios — solo owner_negocio */}
      {(isOwnerNegocio || isSuperOwner) && profile && (
        <>
          <GestionUsuarios myProfileId={profile.id} />
          <InvitarUsuario />
        </>
      )}

      <CambiarContrasena />

      <TouchableOpacity
        style={{
          backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
          flexDirection: 'row', alignItems: 'center',
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 18, marginRight: 12 }}>🚪</Text>
        <Text style={{ color: '#ef4444', fontWeight: '500', fontSize: 15 }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
