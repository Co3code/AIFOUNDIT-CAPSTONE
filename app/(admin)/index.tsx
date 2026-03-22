import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const usersSnap = await getCountFromServer(collection(db, 'users'));
      const postsSnap = await getCountFromServer(collection(db, 'posts'));
      setTotalUsers(usersSnap.data().count);
      setTotalPosts(postsSnap.data().count);
    };
    fetchStats();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>AIFOUNDIT Management</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Ionicons name="people" size={28} color="#2563EB" />
          <Text style={styles.statNumber}>{totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Ionicons name="document-text" size={28} color="#16A34A" />
          <Text style={styles.statNumber}>{totalPosts}</Text>
          <Text style={styles.statLabel}>Total Posts</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/(admin)/users')}>
          <Ionicons name="people-outline" size={22} color="#2563EB" />
          <Text style={styles.actionText}>Manage Users</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/(admin)/posts')}>
          <Ionicons name="document-text-outline" size={22} color="#2563EB" />
          <Text style={styles.actionText}>Manage Posts</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 56, backgroundColor: '#2563EB' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginHorizontal: 24, marginTop: 24, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24 },
  statCard: { flex: 1, padding: 20, borderRadius: 12, alignItems: 'center', gap: 6 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280' },
  quickActions: { marginHorizontal: 24, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  actionItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  actionText: { flex: 1, fontSize: 14, color: '#111827' },
});
