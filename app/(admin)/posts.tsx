import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/config/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

type Post = { id: string; title: string; type: string; description: string; postedBy: string; };

export default function PostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const snap = await getDocs(collection(db, 'posts'));
    setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'posts', id));
          setPosts(prev => prev.filter(p => p.id !== id));
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563EB" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Posts</Text>
        <Text style={styles.subtitle}>{posts.length} total posts</Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={40} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.typeBadge, { backgroundColor: item.type === 'lost' ? '#FEF2F2' : '#F0FDF4' }]}>
                <Text style={[styles.typeText, { color: item.type === 'lost' ? '#EF4444' : '#16A34A' }]}>
                  {item.type?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.postTitle}>{item.title}</Text>
                <Text style={styles.postDesc} numberOfLines={1}>{item.description}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 24, paddingTop: 56, backgroundColor: '#2563EB' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#374151' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, gap: 12 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeText: { fontSize: 11, fontWeight: 'bold' },
  info: { flex: 1 },
  postTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  postDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
