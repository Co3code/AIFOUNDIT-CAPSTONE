import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Post = {
  id: string;
  title: string;
  type: string;
  description: string;
  postedBy: string;
  imageUrl?: string;
};

export default function PostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const snap = await getDocs(collection(db, "posts"));
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ✅ Fix: also cleans up match docs referencing this post
  const purgePostAndMatches = async (postId: string) => {
    // 1. Delete match docs where this post is the primary
    const primarySnap = await getDocs(query(collection(db, "matches"), where("postId", "==", postId)));
    await Promise.all(primarySnap.docs.map((d) => deleteDoc(doc(db, "matches", d.id))));

    // 2. Delete the post itself
    await deleteDoc(doc(db, "posts", postId));
  };

  const handleDeletePost = (item: Post) => {
    // ✅ Fix: double confirmation like users delete
    Alert.alert("Delete Post", `Remove "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "⚠️ Final Warning",
            "This will permanently delete the post and its match records. Cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, Delete",
                style: "destructive",
                onPress: async () => {
                  setDeletingId(item.id);
                  try {
                    await purgePostAndMatches(item.id);
                    setPosts((prev) => prev.filter((p) => p.id !== item.id));
                  } catch (e: any) {
                    Alert.alert("Error", e?.message ?? "Could not delete.");
                  } finally {
                    setDeletingId(null);
                  }
                },
              },
            ],
          );
        },
      },
    ]);
  };

  const handleRemovePhotoOnly = (item: Post) => {
    if (!item.imageUrl) return;
    Alert.alert(
      "Remove photo",
      "Keep the post but clear the image URL? (Cloudinary file may still exist until you delete it there.)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove photo",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "posts", item.id), { imageUrl: null });
              setPosts((prev) => prev.map((p) => (p.id === item.id ? { ...p, imageUrl: undefined } : p)));
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Could not update.");
            }
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#F59E0B" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Posts</Text>
        <Text style={styles.subtitle}>{posts.length} total · admin</Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={40} color="#64748B" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshing={refreshing}
          onRefresh={() => fetchPosts(true)}
          renderItem={({ item }) => {
            const isDeleting = deletingId === item.id;
            return (
              <View style={[styles.card, isDeleting && { opacity: 0.5 }]}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={28} color="#64748B" />
                  </View>
                )}
                <View style={styles.info}>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === "lost" ? "#450A0A" : "#052E16" }]}>
                    <Text style={[styles.typeText, { color: item.type === "lost" ? "#FCA5A5" : "#86EFAC" }]}>
                      {item.type?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.postTitle}>{item.title}</Text>
                  <Text style={styles.postDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={styles.meta}>User: {item.postedBy?.slice(0, 8) ?? "—"}…</Text>
                </View>
                <View style={styles.rowActions}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <>
                      {item.imageUrl ? (
                        <TouchableOpacity style={styles.smallBtn} onPress={() => handleRemovePhotoOnly(item)}>
                          <Ionicons name="image-outline" size={18} color="#FBBF24" />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity style={styles.smallBtnDanger} onPress={() => handleDeletePost(item)}>
                        <Ionicons name="trash-outline" size={18} color="#F87171" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    padding: 24,
    paddingTop: 56,
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#F8FAFC" },
  subtitle: { fontSize: 13, color: "#F59E0B", marginTop: 4, fontWeight: "600" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "bold", color: "#94A3B8" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#0F172A" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeText: { fontSize: 10, fontWeight: "bold" },
  postTitle: { fontSize: 14, fontWeight: "bold", color: "#F8FAFC", marginTop: 6 },
  postDesc: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  meta: { fontSize: 10, color: "#64748B", marginTop: 4 },
  rowActions: { alignItems: "center", gap: 6, minWidth: 36 },
  smallBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  smallBtnDanger: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(185, 28, 28, 0.2)",
  },
});
