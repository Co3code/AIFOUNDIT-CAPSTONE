import { auth, db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar, Platform } from "react-native";

export default function HomeScreen() {
  const [userName, setUserName] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allPosts, setAllPosts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setUserName(snap.data().name ?? "");
    }

    // Fetch all posts for search
    const allSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setAllPosts(all);
    setPosts(showAll ? all : all.slice(0, 6));
  }, [showAll]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const handleSearch = (text: string) => {
    setKeyword(text);
    if (!text.trim()) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    setSearched(true);
    const q = text.trim().toLowerCase();
    const filtered = allPosts.filter(
      (post: any) =>
        post.title?.toLowerCase().includes(q) ||
        post.description?.toLowerCase().includes(q) ||
        post.location?.toLowerCase().includes(q),
    );
    setSearchResults(filtered);
  };

  const clearSearch = () => {
    setKeyword("");
    setSearchResults([]);
    setSearched(false);
  };

  const displayedPosts = searched ? searchResults : posts;

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hi, {userName || "User"} </Text>
            <Text style={styles.subGreeting}>Find or report lost items</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={20} color="#BFDBFE" />
          </View>
        </View>

        {/* ── Inline Search Bar ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, location..."
            placeholderTextColor="#9CA3AF"
            value={keyword}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* ── Search results label ── */}
        {searched && (
          <Text style={styles.resultCount}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{keyword}&quot;
          </Text>
        )}

        {/* ── Quick Actions (hide during search) ── */}
        {!searched && (
          <>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#EFF6FF" }]}
                onPress={() => router.push("/(tabs)/post")}
              >
                <Ionicons name="alert-circle-outline" size={32} color="#2563EB" />
                <Text style={styles.actionTitle}>Report Lost</Text>
                <Text style={styles.actionSub}>Lost something? Post it here</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#F0FDF4" }]}
                onPress={() => router.push("/(tabs)/post")}
              >
                <Ionicons name="checkmark-circle-outline" size={32} color="#16A34A" />
                <Text style={styles.actionTitle}>Report Found</Text>
                <Text style={styles.actionSub}>Found something? Post it here</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Posts Section Header ── */}
        {!searched && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{showAll ? "All Posts" : "Recent Posts"}</Text>
            <TouchableOpacity onPress={() => setShowAll(!showAll)}>
              <Text style={styles.seeAll}>{showAll ? "Show less" : "See all"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Posts Grid (side by side) ── */}
        {displayedPosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={40} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{searched ? "No items found" : "No posts yet"}</Text>
            <Text style={styles.emptyText}>
              {searched ? "Try a different keyword" : "Be the first to report a lost or found item"}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {displayedPosts.map((post) => (
              <View key={post.id} style={styles.gridCard}>
                {(post.imageUrls?.[0] ?? post.imageUrl) ? (
                  <Image source={{ uri: post.imageUrls?.[0] ?? post.imageUrl }} style={styles.gridImage} />
                ) : (
                  <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                    <Ionicons name="image-outline" size={28} color="#D1D5DB" />
                  </View>
                )}
                <View style={styles.gridInfo}>
                  <View style={[styles.gridBadge, { backgroundColor: post.type === "lost" ? "#FEF2F2" : "#F0FDF4" }]}>
                    <Text style={[styles.gridBadgeText, { color: post.type === "lost" ? "#EF4444" : "#16A34A" }]}>
                      {post.type?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <View style={styles.gridLocationRow}>
                    <Ionicons name="location-outline" size={11} color="#9CA3AF" />
                    <Text style={styles.gridLocation} numberOfLines={1}>
                      {post.location}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { flex: 1 },

  // Header
  header: { backgroundColor: "#2563EB", paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 56, paddingBottom: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  subGreeting: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Search bar inline in header
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", paddingVertical: 0 },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: "#2563EB", fontWeight: "600" },
  resultCount: { fontSize: 13, color: "#6B7280", marginHorizontal: 24, marginTop: 16, marginBottom: 4 },

  // Quick actions
  actions: { flexDirection: "row", gap: 12, marginHorizontal: 24 },
  actionCard: { flex: 1, padding: 16, borderRadius: 12, gap: 6 },
  actionTitle: { fontSize: 14, fontWeight: "bold", color: "#111827" },
  actionSub: { fontSize: 11, color: "#6B7280" },

  // Empty state
  emptyCard: { margin: 24, padding: 40, backgroundColor: "#fff", borderRadius: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "bold", color: "#374151" },
  emptyText: { color: "#9CA3AF", fontSize: 13, textAlign: "center" },

  // ✅ Side by side grid
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 16, gap: 12 },
  gridCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  gridImage: { width: "100%", height: 120 },
  gridImagePlaceholder: { justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  gridInfo: { padding: 10, gap: 4 },
  gridBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  gridBadgeText: { fontSize: 9, fontWeight: "bold" },
  gridTitle: { fontSize: 13, fontWeight: "bold", color: "#111827" },
  gridLocationRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  gridLocation: { fontSize: 11, color: "#9CA3AF", flex: 1 },
});
