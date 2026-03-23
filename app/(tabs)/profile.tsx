import { auth, db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type UserDoc = { name?: string; email?: string; phone?: string };
type Post = {
  id: string;
  title: string;
  type: "lost" | "found";
  description: string;
  location: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt?: any;
};

export default function ProfileScreen() {
  const uid = auth.currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(auth.currentUser?.email ?? "");
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data() as UserDoc;
      setName(d.name ?? "");
      setPhone(d.phone ?? "");
      setEmail(d.email ?? auth.currentUser?.email ?? "");
    } else {
      setEmail(auth.currentUser?.email ?? "");
    }
    setLoading(false);
  }, [uid]);

  const loadMyPosts = useCallback(async () => {
    if (!uid) {
      setPostsLoading(false);
      return;
    }
    setPostsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "posts"), where("postedBy", "==", uid)));
      const myPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
      // Sort newest first
      myPosts.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setPosts(myPosts);
    } catch (e) {
      console.error("Failed to load posts:", e);
    } finally {
      setPostsLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadMyPosts();
    }, [loadProfile, loadMyPosts]),
  );

  const handleSave = async () => {
    if (!uid) return;
    if (!name.trim()) return Alert.alert("Name required", "Please enter your name.");
    setSaving(true);
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        updatedAt: serverTimestamp(),
      };
      if (snap.exists()) await updateDoc(ref, payload);
      else {
        await setDoc(ref, {
          ...payload,
          email: auth.currentUser?.email ?? "",
          createdAt: serverTimestamp(),
        });
      }
      Alert.alert("Saved", "Your profile was updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = (post: Post) => {
    Alert.alert("Delete Post", `Remove "${post.title}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "posts", post.id));
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Could not delete post.");
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : "?"}</Text>
          </View>
          <Text style={styles.headerTitle}>{name || "Your Profile"}</Text>
          <Text style={styles.headerSub}>{email}</Text>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{posts.filter((p) => p.type === "lost").length}</Text>
              <Text style={styles.statLabel}>Lost</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{posts.filter((p) => p.type === "found").length}</Text>
              <Text style={styles.statLabel}>Found</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{posts.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* ── Profile Edit Card ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person-outline" size={15} /> Edit Profile
          </Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contact number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Email</Text>
          <Text style={styles.emailReadonly}>{email || "—"}</Text>
          <Text style={styles.hint}>Email cannot be changed here.</Text>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Save profile</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── My Posts Section ── */}
        <View style={styles.postsSection}>
          <Text style={styles.postsSectionTitle}>My Posts</Text>

          {postsLoading ? (
            <ActivityIndicator color="#2563EB" style={{ marginTop: 16 }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="file-tray-outline" size={36} color="#9CA3AF" />
              <Text style={styles.emptyPostsText}>No posts yet</Text>
              <Text style={styles.emptyPostsHint}>Items you report will appear here</Text>
            </View>
          ) : (
            posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                {/* Image */}
                {(post.imageUrls?.[0] ?? post.imageUrl) ? (
                  <Image source={{ uri: post.imageUrls?.[0] ?? post.imageUrl }} style={styles.postThumb} />
                ) : (
                  <View style={[styles.postThumb, styles.postThumbPlaceholder]}>
                    <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                  </View>
                )}

                {/* Info */}
                <View style={styles.postInfo}>
                  <View style={[styles.typeBadge, { backgroundColor: post.type === "lost" ? "#FEF2F2" : "#F0FDF4" }]}>
                    <Text style={[styles.typeBadgeText, { color: post.type === "lost" ? "#EF4444" : "#16A34A" }]}>
                      {post.type?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.postTitle} numberOfLines={1}>
                    {post.title}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={11} color="#9CA3AF" />
                    <Text style={styles.postLocation} numberOfLines={1}>
                      {post.location}
                    </Text>
                  </View>
                  <Text style={styles.postDesc} numberOfLines={2}>
                    {post.description}
                  </Text>
                </View>

                {/* Delete button */}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePost(post)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F4F6" },

  // Header
  header: {
    padding: 24,
    paddingTop: 56,
    backgroundColor: "#2563EB",
    alignItems: "center",
    gap: 4,
    paddingBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 13, color: "#BFDBFE" },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 0,
  },
  statBox: { alignItems: "center", paddingHorizontal: 20 },
  statNum: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  statLabel: { fontSize: 11, color: "#BFDBFE", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.3)" },

  // Profile card
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    gap: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 10 },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  emailReadonly: { fontSize: 15, color: "#6B7280", paddingVertical: 8 },
  hint: { fontSize: 11, color: "#9CA3AF", marginBottom: 8 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // My Posts
  postsSection: { marginHorizontal: 20, marginTop: 24 },
  postsSectionTitle: { fontSize: 16, fontWeight: "bold", color: "#111827", marginBottom: 12 },
  emptyPosts: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
    borderRadius: 14,
    gap: 6,
  },
  emptyPostsText: { fontSize: 14, fontWeight: "bold", color: "#6B7280" },
  emptyPostsHint: { fontSize: 12, color: "#9CA3AF" },

  postCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  postThumb: { width: 68, height: 68, borderRadius: 10, backgroundColor: "#F3F4F6" },
  postThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  postInfo: { flex: 1, gap: 3 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typeBadgeText: { fontSize: 10, fontWeight: "bold" },
  postTitle: { fontSize: 14, fontWeight: "bold", color: "#111827" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  postLocation: { fontSize: 11, color: "#9CA3AF", flex: 1 },
  postDesc: { fontSize: 12, color: "#6B7280" },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 10,
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
