import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';

type User = { id: string; name: string; email: string; role?: string; };

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563EB" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>{users.length} registered users</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 24, gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons name="person-circle" size={40} color="#2563EB" />
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.email}>{item.email}</Text>
            </View>
            {item.role === 'admin' && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Admin</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 24, paddingTop: 56, backgroundColor: '#2563EB' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, gap: 12 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  email: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, color: '#2563EB', fontWeight: 'bold' },
});
