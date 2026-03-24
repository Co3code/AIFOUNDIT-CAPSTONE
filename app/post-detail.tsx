import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [post, setPost] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "posts", postId));
        if (!snap.exists()) return;
        const data = { id: snap.id, ...snap.data() };
        setPost(data);
        if ((data as any).postedBy) {
          const userSnap = await getDoc(doc(db, "users", (data as any).postedBy));
          if (userSnap.exists()) setPoster(userSnap.data());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [postId]);

  const imageUrls: string[] = post?.imageUrls ?? (post?.imageUrl ? [post.imageUrl] : []);

  const contact = (type: "email" | "phone") => {
    if (type === "email" && poster?.email) {
      Linking.openURL(`mailto:${poster.email}?subject=Regarding your ${post?.type} item: ${post?.title}`);
    } else if (type === "phone" && poster?.phone) {
      Linking.openURL(`tel:${poster.phone}`);
    } else {
      Alert.alert("Not available", "This contact method is not provided.");
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#2563EB" />;
  if (!post) return (
    <View style={styles.centered}>
      <Text style={styles.notFound}>Post not found.</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>Go back</Text></TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Detail</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Images */}
      {imageUrls.length > 0 ? (
        <View>
          <Image source={{ uri: imageUrls[imgIndex] }} style={styles.mainImage} />
          {imageUrls.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {imageUrls.map((uri, i) => (
                <TouchableOpacity key={i} onPress={() => setImgIndex(i)}>
                  <Image source={{ uri }} style={[styles.thumb, imgIndex === i && styles.thumbActive]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={48} color="#D1D5DB" />
        </View>
      )}

      {/* Info */}
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: post.type === "lost" ? "#FEF2F2" : "#F0FDF4" }]}>
            <Text style={[styles.badgeText, { color: post.type === "lost" ? "#EF4444" : "#16A34A" }]}>
              {post.type?.toUpperCase()}
            </Text>
          </View>
          {post.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{post.category}</Text>
            </View>
          )}
        </View>

        <Text style={styles.postTitle}>{post.title}</Text>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={15} color="#6B7280" />
          <Text style={styles.rowText}>{post.location}</Text>
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.description}>{post.description}</Text>

        {/* Poster info */}
        <Text style={styles.sectionLabel}>Posted by</Text>
        <View style={styles.posterCard}>
          <View style={styles.posterAvatar}>
            <Text style={styles.posterAvatarText}>{poster?.name?.charAt(0)?.toUpperCase() ?? "?"}</Text>
          </View>
          <View>
            <Text style={styles.posterName}>{poster?.name ?? "Unknown"}</Text>
            <Text style={styles.posterSub}>Tap below to contact</Text>
          </View>
        </View>

        {/* Contact buttons */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={() => contact("email")}>
            <Ionicons name="mail-outline" size={18} color="#fff" />
            <Text style={styles.contactBtnText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactBtn, styles.contactBtnGreen]} onPress={() => contact("phone")}>
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.contactBtnText}>Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notFound: { fontSize: 15, color: "#6B7280" },
  back: { color: "#2563EB", fontWeight: "600" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#fff" },

  mainImage: { width: "100%", height: 280 },
  imagePlaceholder: { width: "100%", height: 200, backgroundColor: "#F9FAFB", justifyContent: "center", alignItems: "center" },
  thumbRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  thumb: { width: 60, height: 60, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  thumbActive: { borderColor: "#2563EB" },

  content: { padding: 20, gap: 8 },
  badgeRow: { flexDirection: "row", gap: 8 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#EFF6FF" },
  categoryBadgeText: { fontSize: 11, fontWeight: "600", color: "#2563EB", textTransform: "capitalize" },

  postTitle: { fontSize: 22, fontWeight: "bold", color: "#111827", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowText: { fontSize: 13, color: "#6B7280" },

  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 12 },
  description: { fontSize: 14, color: "#4B5563", lineHeight: 22 },

  posterCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", padding: 14, borderRadius: 12,
  },
  posterAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center",
  },
  posterAvatarText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  posterName: { fontSize: 15, fontWeight: "bold", color: "#111827" },
  posterSub: { fontSize: 12, color: "#9CA3AF" },

  contactRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#2563EB", paddingVertical: 14, borderRadius: 10,
  },
  contactBtnGreen: { backgroundColor: "#16A34A" },
  contactBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
