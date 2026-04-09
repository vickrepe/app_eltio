import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página no encontrada' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
          Esta pantalla no existe
        </Text>
        <Link href="/">
          <Text style={{ color: '#2563eb' }}>Ir al inicio</Text>
        </Link>
      </View>
    </>
  );
}
