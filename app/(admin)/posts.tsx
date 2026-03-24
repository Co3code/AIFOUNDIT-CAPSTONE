import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type Post = {
  id: string;
  title: string;
  type: string;
  description: string;
  postedBy: string;
  imageUrl?: string;
  imageUrls?: string[];
  status?: string;
};

export default function PostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "lost" | "found" | "resolved">("all");
  const [search, setSearch] = useState("");

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
    if (!item.imageUrl && !item.imageUrls?.length) return;
    Alert.alert("Remove photo", "Keep the post but clear the image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove photo",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "posts", item.id), { imageUrl: null, imageUrls: [] });
            setPosts((prev) => prev.map((p) => (p.id === item.id ? { ...p, imageUrl: undefined, imageUrls: [] } : p)));
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Could not update.");
          }
        },
      },
    ]);
  };

  const handleToggleResolved = async (item: Post) => {
    const newStatus = item.status === "resolved" ? "open" : "resolved";
    try {
      await updateDoc(doc(db, "posts", item.id), { status: newStatus });
      setPosts((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: newStatus } : p)));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update status.");
    }
  };

  const filteredPosts = posts.filter((p) => {
    const matchesFilter =
      filter === "all" ? true :
      filter === "resolved" ? p.status === "resolved" :
      p.type === filter && p.status !== "resolved";
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#F59E0B" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Posts</Text>
          <Text style={styles.subtitle}>{posts.length} total · admin</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search title or description..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "lost", "found", "resolved"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredPosts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={40} color="#64748B" />
          <Text style={styles.emptyTitle}>No posts found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          refreshing={refreshing}
          onRefresh={() => fetchPosts(true)}
          renderItem={({ item }) => {
            const isDeleting = deletingId === item.id;
            const isResolved = item.status === "resolved";
            return (
              <View style={[styles.card, isDeleting && { opacity: 0.5 }, isResolved && styles.cardResolved]}>
                {(item.imageUrls?.[0] ?? item.imageUrl) ? (
                  <Image source={{ uri: item.imageUrls?.[0] ?? item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={28} color="#64748B" />
                  </View>
                )}
                <View style={styles.info}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.typeBadge, { backgroundColor: item.type === "lost" ? "#450A0A" : "#052E16" }]}>
                      <Text style={[styles.typeText, { color: item.type === "lost" ? "#FCA5A5" : "#86EFAC" }]}>
                        {item.type?.toUpperCase()}
                      </Text>
                    </View>
                    {isResolved && (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedBadgeText}>RESOLVED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.postTitle}>{item.title}</Text>
                  <Text style={styles.postDesc} numberOfLines={2}>{item.description}</Text>
                  <Text style={styles.meta}>User: {item.postedBy?.slice(0, 8) ?? "—"}…</Text>
                </View>
                <View style={styles.rowActions}>
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.smallBtn, isResolved && styles.smallBtnResolved]}
                        onPress={() => handleToggleResolved(item)}
                      >
                        <Ionicons
                          name={isResolved ? "refresh-outline" : "checkmark-done-outline"}
                          size={18}
                          color={isResolved ? "#94A3B8" : "#34D399"}
                        />
                      </TouchableOpacity>
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
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 24, paddingTop: 56,
    backgroundColor: "#1E293B",
    borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "bold", color: "#F8FAFC" },
  subtitle: { fontSize: 13, color: "#F59E0B", marginTop: 4, fontWeight: "600" },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, marginBottom: 8,
    backgroundColor: "#1E293B", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#334155",
  },
  searchInput: { flex: 1, color: "#F8FAFC", fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#1E293B", borderWidth: 1, borderColor: "#334155",
  },
  filterBtnActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  filterBtnText: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  filterBtnTextActive: { color: "#0F172A" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "bold", color: "#94A3B8" },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1E293B", padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "#334155", gap: 12,
  },
  cardResolved: { opacity: 0.6, borderColor: "#34D399" },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#0F172A" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: "row", gap: 6 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeText: { fontSize: 10, fontWeight: "bold" },
  resolvedBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: "#052E16" },
  resolvedBadgeText: { fontSize: 10, fontWeight: "bold", color: "#34D399" },
  postTitle: { fontSize: 14, fontWeight: "bold", color: "#F8FAFC", marginTop: 6 },
  postDesc: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  meta: { fontSize: 10, color: "#64748B", marginTop: 4 },
  rowActions: { alignItems: "center", gap: 6, minWidth: 36 },
  smallBtn: {
    padding: 8, borderRadius: 8,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderWidth: 1, borderColor: "rgba(52, 211, 153, 0.35)",
  },
  smallBtnResolved: { backgroundColor: "rgba(100,116,139,0.15)", borderColor: "#334155" },
  smallBtnDanger: { padding: 8, borderRadius: 8, backgroundColor: "rgba(185, 28, 28, 0.2)" },
});
