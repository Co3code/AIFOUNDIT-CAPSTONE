import { auth, db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { arrayUnion, collection, doc, documentId, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MatchPair = {
  matchDocId: string;
  matchFirestoreId: string;  // actual Firestore match doc ID
  myPost: any;
  matchedPost: any;
  matchedUser: any;
  score: number;
  retrievedBy: string[];
};

// ─── Helper: batch fetch docs by IDs (Firestore `in` max 10) ─────────────────
async function batchGetDocs(collectionName: string, ids: string[]): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const result: Record<string, any> = {};

  // Deduplicate IDs first
  const uniqueIds = [...new Set(ids)];

  // Chunk into groups of 10 (Firestore limit for `in` queries)
  for (let i = 0; i < uniqueIds.length; i += 10) {
    const chunk = uniqueIds.slice(i, i + 10);
    const snap = await getDocs(query(collection(db, collectionName), where(documentId(), "in", chunk)));
    snap.docs.forEach((d) => {
      result[d.id] = { id: d.id, ...d.data() };
    });
  }

  return result;
}

export default function MatchesScreen() {
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const postsSnap = await getDocs(query(collection(db, "posts"), where("postedBy", "==", uid)));
      const myPostsMap: Record<string, any> = {};
      postsSnap.docs.forEach((d) => { myPostsMap[d.id] = { id: d.id, ...d.data() }; });
      const myPostIds = Object.keys(myPostsMap);
      if (myPostIds.length === 0) { setPairs([]); return; }

      const matchSnapPromises: Promise<any>[] = [];
      for (let i = 0; i < myPostIds.length; i += 10) {
        const chunk = myPostIds.slice(i, i + 10);
        matchSnapPromises.push(getDocs(query(collection(db, "matches"), where("postId", "in", chunk))));
      }
      const matchSnaps = await Promise.all(matchSnapPromises);
      const allMatchDocs = matchSnaps.flatMap((s) => s.docs);
      if (allMatchDocs.length === 0) { setPairs([]); return; }

      const matchedPostIds: string[] = [];
      for (const matchDoc of allMatchDocs) {
        const data = matchDoc.data();
        if (!myPostsMap[data.postId]) continue;
        for (const m of data.matches ?? []) matchedPostIds.push(m.postId);
      }

      const matchedPostsMap = await batchGetDocs("posts", matchedPostIds);
      const matchedUserIds = [
        ...new Set(Object.values(matchedPostsMap).map((p: any) => p.postedBy).filter(Boolean)),
      ];
      const matchedUsersMap = await batchGetDocs("users", matchedUserIds);

      const result: MatchPair[] = [];
      for (const matchDoc of allMatchDocs) {
        const data = matchDoc.data();
        const myPost = myPostsMap[data.postId];
        if (!myPost) continue;
        for (const m of data.matches ?? []) {
          const matchedPost = matchedPostsMap[m.postId];
          if (!matchedPost) continue;
          result.push({
            matchDocId: `${matchDoc.id}||${m.postId}`,
            matchFirestoreId: matchDoc.id,
            myPost,
            matchedPost,
            matchedUser: matchedUsersMap[matchedPost.postedBy] ?? null,
            score: m.score,
            retrievedBy: data.retrievedBy ?? [],
          });
        }
      }

      result.sort((a, b) => b.score - a.score);
      setPairs(result);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load matches. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      lastFetchRef.current = Date.now();
      fetchMatches();
    }, [fetchMatches]),
  );

  const handleMarkRetrieved = async (pair: MatchPair) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const matchRef = doc(db, "matches", pair.matchFirestoreId);
      await updateDoc(matchRef, { retrievedBy: arrayUnion(uid) });

      // Re-fetch the match doc to get the real retrievedBy array after update
      const freshMatchDoc = await getDoc(matchRef);
      const freshRetrievedBy: string[] = freshMatchDoc.data()?.retrievedBy ?? [];

      const bothConfirmed =
        freshRetrievedBy.includes(pair.myPost.postedBy) &&
        freshRetrievedBy.includes(pair.matchedPost.postedBy);

      if (bothConfirmed) {
        await Promise.all([
          updateDoc(doc(db, "posts", pair.myPost.id), { status: "resolved" }),
          updateDoc(doc(db, "posts", pair.matchedPost.id), { status: "resolved" }),
        ]);
      }

      setPairs((prev) =>
        prev.map((p) =>
          p.matchDocId === pair.matchDocId
            ? {
                ...p,
                retrievedBy: freshRetrievedBy,
                myPost: bothConfirmed ? { ...p.myPost, status: "resolved" } : p.myPost,
                matchedPost: bothConfirmed ? { ...p.matchedPost, status: "resolved" } : p.matchedPost,
              }
            : p,
        ),
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update.");
    }
  };

  const handleContact = (matchedUser: any) => {
    const email = matchedUser?.email;
    const phone = matchedUser?.phone;
    if (!email && !phone) return Alert.alert("No contact info", "This user has no email or phone on file.");

    const buttons: any[] = [{ text: "Cancel", style: "cancel" }];
    if (email) buttons.push({ text: "Email", onPress: () => Linking.openURL(`mailto:${email}`) });
    if (phone)
      buttons.push({ text: "Call", onPress: () => Linking.openURL(`tel:${String(phone).replace(/\s/g, "")}`) });

    Alert.alert(
      "Contact",
      matchedUser?.name ? `Reach ${matchedUser.name}` : "Choose how to contact this user.",
      buttons,
    );
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );

  if (error)
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchMatches}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
        <Text style={styles.subtitle}>
          {pairs.length > 0
            ? `${pairs.length} possible match${pairs.length > 1 ? "es" : ""} found`
            : "Possible matches for your items"}
        </Text>
      </View>

      {pairs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>Well notify you when a match is found</Text>
        </View>
      ) : (
        <FlatList
          data={pairs}
          keyExtractor={(item) => item.matchDocId}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => (
            <MatchCard pair={item} onContact={handleContact} onMarkRetrieved={handleMarkRetrieved} currentUid={auth.currentUser?.uid ?? ""} />
          )}
        />
      )}
    </View>
  );
}

function MatchCard({
  pair, onContact, onMarkRetrieved, currentUid,
}: {
  pair: MatchPair;
  onContact: (u: any) => void;
  onMarkRetrieved: (p: MatchPair) => void;
  currentUid: string;
}) {
  const { myPost, matchedPost, matchedUser, score, retrievedBy } = pair;
  const scoreColor = score >= 70 ? "#16A34A" : score >= 40 ? "#D97706" : "#6B7280";
  const isResolved = myPost.status === "resolved" || matchedPost.status === "resolved";
  const iConfirmed = retrievedBy.includes(currentUid);
  const bothConfirmed = isResolved;

  return (
    <View style={styles.card}>
      {/* Match confidence banner */}
      <View style={[styles.banner, { backgroundColor: scoreColor }]}>
        <Ionicons name="checkmark-circle" size={15} color="#fff" />
        <Text style={styles.bannerText}>{score}% Match Confidence</Text>
      </View>

      {/* Side by side posts */}
      <View style={styles.row}>
        <PostSide post={myPost} label="Your Post" labelColor="#2563EB" />
        <View style={styles.vsCol}>
          <View style={styles.vsLine} />
          <View style={styles.vsCircle}>
            <Ionicons name="swap-horizontal" size={16} color="#6B7280" />
          </View>
          <View style={styles.vsLine} />
        </View>
        <PostSide post={matchedPost} label="Possible Match" labelColor="#16A34A" />
      </View>

      {/* Matched user info + contact */}
      <View style={styles.contactRow}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{matchedUser?.name || "Unknown User"}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {[matchedUser?.email, matchedUser?.phone].filter(Boolean).join(" · ") || "No contact info"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.contactBtn} onPress={() => onContact(matchedUser)}>
          <Ionicons name="mail-outline" size={15} color="#fff" />
          <Text style={styles.contactBtnText}>Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Mark as Retrieved */}
      <View style={styles.retrieveRow}>
        {bothConfirmed ? (
          <View style={styles.retrievedDone}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.retrievedDoneText}>Item Retrieved</Text>
          </View>
        ) : iConfirmed ? (
          <View style={styles.retrievedWaiting}>
            <Ionicons name="time-outline" size={16} color="#D97706" />
            <Text style={styles.retrievedWaitingText}>Waiting for other user to confirm</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.retrieveBtn} onPress={() => onMarkRetrieved(pair)}>
            <Ionicons name="bag-check-outline" size={15} color="#fff" />
            <Text style={styles.retrieveBtnText}>Mark as Retrieved</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PostSide({ post, label, labelColor }: { post: any; label: string; labelColor: string }) {
  return (
    <View style={styles.side}>
      <Text style={[styles.sideLabel, { color: labelColor }]}>{label}</Text>
      {(post.imageUrls?.[0] ?? post.imageUrl) ? (
        <Image source={{ uri: post.imageUrls?.[0] ?? post.imageUrl }} style={styles.sideImage} />
      ) : (
        <View style={[styles.sideImage, styles.noImage]}>
          <Ionicons name="image-outline" size={28} color="#D1D5DB" />
        </View>
      )}
      <View style={[styles.typeBadge, { backgroundColor: post.type === "lost" ? "#FEF2F2" : "#F0FDF4" }]}>
        <Text style={[styles.typeBadgeText, { color: post.type === "lost" ? "#EF4444" : "#16A34A" }]}>
          {post.type?.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.sideTitle} numberOfLines={2}>
        {post.title}
      </Text>
      <View style={styles.locationRow}>
        <Ionicons name="location-outline" size={11} color="#9CA3AF" />
        <Text style={styles.sideLocation} numberOfLines={1}>
          {post.location}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#F3F4F6" },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: { padding: 24, paddingTop: 56, backgroundColor: "#2563EB" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "bold", color: "#374151" },
  emptyText: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  errorText: { fontSize: 14, color: "#EF4444", textAlign: "center" },
  retryBtn: { marginTop: 8, backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  banner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  bannerText: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  row: { flexDirection: "row", padding: 12, gap: 4 },
  side: { flex: 1, gap: 5 },
  sideLabel: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
  sideImage: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#F9FAFB" },
  noImage: { justifyContent: "center", alignItems: "center" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typeBadgeText: { fontSize: 10, fontWeight: "bold" },
  sideTitle: { fontSize: 12, fontWeight: "600", color: "#111827" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  sideLocation: { fontSize: 11, color: "#9CA3AF", flex: 1 },

  vsCol: { width: 28, alignItems: "center", justifyContent: "center" },
  vsLine: { flex: 1, width: 1, backgroundColor: "#E5E7EB" },
  vsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  userName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  userEmail: { fontSize: 11, color: "#6B7280" },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  contactBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  retrieveRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  retrieveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16A34A",
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
  },
  retrieveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  retrievedDone: { flexDirection: "row", alignItems: "center", gap: 6 },
  retrievedDoneText: { color: "#16A34A", fontWeight: "bold", fontSize: 13 },
  retrievedWaiting: { flexDirection: "row", alignItems: "center", gap: 6 },
  retrievedWaitingText: { color: "#D97706", fontSize: 12 },
});
