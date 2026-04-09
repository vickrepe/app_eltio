import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { useAppStore } from '../../lib/store';

export default function PerfilScreen() {
  const { profile, organization, signOut } = useAppStore();

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro que querés cerrar sesión?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Cerrar sesión',
        '¿Estás seguro que querés cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: signOut },
        ]
      );
    }
  };

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-6">
      {/* Card de usuario */}
      <View
        className="bg-white rounded-2xl p-5 mb-4"
        style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
      >
        <View className="flex-row items-center mb-4">
          <View className="w-14 h-14 rounded-full bg-primary-100 items-center justify-center mr-4">
            <Text className="text-primary-600 font-bold text-xl">
              {profile?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View>
            <Text className="text-slate-800 font-semibold text-lg">{profile?.nombre ?? '—'}</Text>
            <View className={`mt-1 rounded-full px-2.5 py-0.5 self-start ${
              profile?.rol === 'owner' ? 'bg-primary-100' : 'bg-slate-100'
            }`}>
              <Text className={`text-xs font-medium ${
                profile?.rol === 'owner' ? 'text-primary-700' : 'text-slate-600'
              }`}>
                {profile?.rol === 'owner' ? 'Dueño' : 'Empleado'}
              </Text>
            </View>
          </View>
        </View>

        <View className="border-t border-slate-100 pt-4">
          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-1">Negocio</Text>
          <Text className="text-slate-800 font-medium">{organization?.nombre ?? '—'}</Text>
        </View>
      </View>

      {/* Cerrar sesión */}
      <TouchableOpacity
        className="bg-white rounded-2xl px-5 py-4 flex-row items-center"
        style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text className="text-red-500 text-lg mr-3">🚪</Text>
        <Text className="text-red-500 font-medium text-base">Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}
