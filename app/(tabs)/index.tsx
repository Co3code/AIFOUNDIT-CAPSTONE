import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { doc, getDoc, collection, getDocs, orderBy, query, limit } from 'firebase/firestore';

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUserName(snap.data().name);
      }
    };
    const fetchPosts = async () => {
      let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      if (!showAll) {
        q = query(q, limit(5));
      }
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchUser();
    fetchPosts();
  }, [showAll]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {userName || 'User'}</Text>
          <Text style={styles.subGreeting}>Find or report lost items</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{showAll ? 'All Posts' : 'Recent Posts'}</Text>
        <TouchableOpacity onPress={() => setShowAll(!showAll)}>
          <Text style={styles.seeAll}>{showAll ? 'Show less' : 'See all'}</Text>
        </TouchableOpacity>
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="file-tray-outline" size={40} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>Be the first to report a lost or found item</Text>
        </View>
      ) : (
        <View style={styles.postsList}>
          {posts.map(post => (
            <View key={post.id} style={styles.postCard}>
              {post.imageUrl && <Image source={{ uri: post.imageUrl }} style={styles.postImage} />}
              <View style={styles.postInfo}>
                <View style={[styles.postBadge, { backgroundColor: post.type === 'lost' ? '#FEF2F2' : '#F0FDF4' }]}>
                  <Text style={[styles.postBadgeText, { color: post.type === 'lost' ? '#EF4444' : '#16A34A' }]}>
                    {post.type?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postLocation}>{post.location}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 56, backgroundColor: '#2563EB' },
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
  postsList: { marginHorizontal: 24, gap: 12, marginBottom: 24 },
  postCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  postImage: { width: '100%', height: 160 },
  postInfo: { padding: 12, gap: 4 },
  postBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  postBadgeText: { fontSize: 11, fontWeight: 'bold' },
  postTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  postLocation: { fontSize: 12, color: '#6B7280' },
});
