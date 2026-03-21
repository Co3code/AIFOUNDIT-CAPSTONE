import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Ionicons name="person-circle" size={80} color="#2563EB" />
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', gap: 12 },
  email: { fontSize: 14, color: '#6B7280' },
  button: { flexDirection: 'row', backgroundColor: '#EF4444', padding: 12, borderRadius: 8, alignItems: 'center', gap: 6, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
