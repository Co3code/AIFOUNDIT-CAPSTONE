import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function HomeScreen() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUserName(snap.data().name);
      }
    };
    fetchUser();
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {userName || 'User'}</Text>
          <Text style={styles.subGreeting}>Find or report lost items</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#EFF6FF' }]} onPress={() => router.push('/(tabs)/post')}>
          <Ionicons name="alert-circle-outline" size={32} color="#2563EB" />
          <Text style={styles.actionTitle}>Report Lost</Text>
          <Text style={styles.actionSub}>Lost something? Post it here</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#F0FDF4' }]} onPress={() => router.push('/(tabs)/post')}>
          <Ionicons name="checkmark-circle-outline" size={32} color="#16A34A" />
          <Text style={styles.actionTitle}>Report Found</Text>
          <Text style={styles.actionSub}>Found something? Post it here</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Posts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Posts</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyCard}>
        <Ionicons name="file-tray-outline" size={40} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyText}>Be the first to report a lost or found item</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 56,
    backgroundColor: '#2563EB',
  },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subGreeting: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 24, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginHorizontal: 24, marginTop: 24, marginBottom: 12 },
  seeAll: { fontSize: 13, color: '#2563EB' },
  actions: { flexDirection: 'row', gap: 12, marginHorizontal: 24 },
  actionCard: { flex: 1, padding: 16, borderRadius: 12, gap: 6 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  actionSub: { fontSize: 11, color: '#6B7280' },
  emptyCard: { margin: 24, padding: 40, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
  emptyText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
});
