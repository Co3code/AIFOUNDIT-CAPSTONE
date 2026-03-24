import { auth, db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalResolved, setTotalResolved] = useState(0);
  const [loading, setLoading] = useState(true);

  // ✅ Fix: useFocusEffect so stats refresh every time admin comes back to dashboard
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, postsSnap, matchesSnap, resolvedSnap] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "posts")),
        getCountFromServer(collection(db, "matches")),
        getCountFromServer(query(collection(db, "posts"), where("status", "==", "resolved"))),
      ]);
      setTotalUsers(usersSnap.data().count);
      setTotalPosts(postsSnap.data().count);
      setTotalMatches(matchesSnap.data().count);
      setTotalResolved(resolvedSnap.data().count);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats]),
  );

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>AIFOUNDIT · moderation</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
          <Ionicons name="log-out-outline" size={24} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      {loading ? (
        <ActivityIndicator color="#F59E0B" style={{ marginTop: 16 }} />
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={28} color="#F59E0B" />
            <Text style={styles.statNumber}>{totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={28} color="#38BDF8" />
            <Text style={styles.statNumber}>{totalPosts}</Text>
            <Text style={styles.statLabel}>Total Posts</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWide]}>
            <Ionicons name="git-compare-outline" size={28} color="#A78BFA" />
            <Text style={styles.statNumber}>{totalMatches}</Text>
            <Text style={styles.statLabel}>AI Match Records</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWide]}>
            <Ionicons name="checkmark-done-circle" size={28} color="#34D399" />
            <Text style={styles.statNumber}>{totalResolved}</Text>
            <Text style={styles.statLabel}>Resolved Cases</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/(admin)/users")}>
          <View style={[styles.actionIcon, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
            <Ionicons name="people-outline" size={20} color="#F59E0B" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionText}>Manage Users</Text>
            <Text style={styles.actionSub}>{totalUsers} registered</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionItem, { borderBottomWidth: 0 }]}
          onPress={() => router.push("/(admin)/posts")}
        >
          <View style={[styles.actionIcon, { backgroundColor: "rgba(56,189,248,0.15)" }]}>
            <Ionicons name="document-text-outline" size={20} color="#38BDF8" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionText}>Manage Posts</Text>
            <Text style={styles.actionSub}>{totalPosts} total posts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Refresh button */}
      <TouchableOpacity style={styles.refreshBtn} onPress={fetchStats}>
        <Ionicons name="refresh-outline" size={16} color="#64748B" />
        <Text style={styles.refreshText}>Refresh stats</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingTop: 56,
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#F8FAFC" },
  subtitle: { fontSize: 13, color: "#F59E0B", marginTop: 4, fontWeight: "600" },
  logoutIcon: { padding: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#94A3B8",
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginHorizontal: 24 },
  statCard: {
    flex: 1,
    minWidth: "40%",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statCardWide: { flexBasis: '100%', minWidth: 0 },
  statNumber: { fontSize: 28, fontWeight: "bold", color: "#F8FAFC" },
  statLabel: { fontSize: 12, color: "#94A3B8" },
  quickActions: {
    marginHorizontal: 24,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  actionTextCol: { flex: 1 },
  actionText: { fontSize: 14, color: "#E2E8F0", fontWeight: "600" },
  actionSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    marginBottom: 40,
    padding: 12,
  },
  refreshText: { fontSize: 13, color: "#64748B" },
});
