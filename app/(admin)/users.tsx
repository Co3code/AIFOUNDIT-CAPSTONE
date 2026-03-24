import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, query, where, deleteDoc,
} from 'firebase/firestore';

type User = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  phone?: string;
};

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (item: User) => {
    setEditUser(item);
    setEditName(item.name ?? '');
    setEditPhone(item.phone ?? '');
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditName('');
    setEditPhone('');
  };

  const saveUser = async () => {
    if (!editUser || !editName.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', editUser.id), {
        name: editName.trim(),
        phone: editPhone.trim() || null,
      });
      setUsers(prev =>
        prev.map(u =>
          u.id === editUser.id
            ? { ...u, name: editName.trim(), phone: editPhone.trim() || undefined }
            : u
        )
      );
      closeEdit();
      Alert.alert('Saved', 'User profile updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // ── Helper: delete all Firestore data for a user ─────────────────────────
  const purgeUserData = async (userId: string) => {
    // 1. Get all posts by this user
    const postsSnap = await getDocs(
      query(collection(db, 'posts'), where('postedBy', '==', userId))
    );
    const postIds = postsSnap.docs.map(d => d.id);

    // 2. Delete all posts
    await Promise.all(postsSnap.docs.map(d => deleteDoc(doc(db, 'posts', d.id))));

    // 3. Delete match docs where postId belongs to this user
    if (postIds.length > 0) {
      for (let i = 0; i < postIds.length; i += 10) {
        const chunk = postIds.slice(i, i + 10);
        const matchSnap = await getDocs(
          query(collection(db, 'matches'), where('postId', 'in', chunk))
        );
        await Promise.all(matchSnap.docs.map(d => deleteDoc(doc(db, 'matches', d.id))));
      }
    }

    // 4. Delete the user document itself
    await deleteDoc(doc(db, 'users', userId));
  };

  const deleteUser = (item: User) => {
    // Guard: admin cannot delete themselves
    if (item.id === auth.currentUser?.uid) {
      Alert.alert('Not allowed', 'You cannot delete your own account.');
      return;
    }

    // Step 1: First confirmation
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${item.name || item.email}"?\n\nThis will permanently remove their account and all their posts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Step 2: Second confirmation to prevent accidental deletes
            Alert.alert(
              '⚠️ Final Warning',
              `This CANNOT be undone.\n\nDelete "${item.name || item.email}" and all their data permanently?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingId(item.id);
                    try {
                      await purgeUserData(item.id);
                      setUsers(prev => prev.filter(u => u.id !== item.id));
                      Alert.alert('Done', `"${item.name || item.email}" has been deleted.`);
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Delete failed. Check Firestore rules.');
                    } finally {
                      setDeletingId(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleResetPassword = (item: User) => {
    if (!item.email) return Alert.alert('No email', 'This user has no email on file.');
    Alert.alert(
      'Reset Password',
      `Send a password reset email to ${item.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, item.email!);
              Alert.alert('Sent', `Password reset email sent to ${item.email}.`);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not send reset email.');
            }
          },
        },
      ]
    );
  };

  const deleteUserPosts = (item: User) => {
    Alert.alert(
      'Delete all posts',
      `Remove every post for ${item.name || item.email}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete posts',
          style: 'destructive',
          onPress: async () => {
            try {
              const q = query(collection(db, 'posts'), where('postedBy', '==', item.id));
              const snap = await getDocs(q);
              await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'posts', d.id))));
              Alert.alert('Done', `Deleted ${snap.size} post(s).`);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Delete failed.');
            }
          },
        },
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#F59E0B" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>{users.length} registered · admin</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshing={refreshing}
        onRefresh={() => fetchUsers(true)}
        renderItem={({ item }) => {
          const isSelf = item.id === auth.currentUser?.uid;
          const isDeleting = deletingId === item.id;

          return (
            <View style={[styles.card, isDeleting && { opacity: 0.5 }]}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color="#F59E0B" />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name || 'No name'}</Text>
                <Text style={styles.email}>{item.email || '—'}</Text>
                {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
                {isSelf && <Text style={styles.youLabel}>· You</Text>}
              </View>
              {item.role === 'admin' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
              <View style={styles.actions}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                      <Ionicons name="create-outline" size={20} color="#1E293B" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtnKey} onPress={() => handleResetPassword(item)}>
                      <Ionicons name="key-outline" size={20} color="#60A5FA" />
                    </TouchableOpacity>
                    {!isSelf && (
                      <TouchableOpacity
                        style={styles.iconBtnDanger}
                        onPress={() => deleteUserPosts(item)}>
                        <Ionicons name="images-outline" size={20} color="#B91C1C" />
                      </TouchableOpacity>
                    )}
                    {!isSelf && (
                      <TouchableOpacity
                        style={styles.iconBtnDelete}
                        onPress={() => deleteUser(item)}>
                        <Ionicons name="person-remove-outline" size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Edit Modal */}
      <Modal visible={!!editUser} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit user</Text>
              <TouchableOpacity onPress={closeEdit}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.modalLabel}>Phone</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Optional"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.modalHint}>
                Email comes from authentication and is not edited here.
              </Text>
              <TouchableOpacity
                style={[styles.modalSave, saving && { opacity: 0.7 }]}
                onPress={saveUser}
                disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    padding: 24, paddingTop: 56,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC' },
  subtitle: { fontSize: 13, color: '#F59E0B', marginTop: 4, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#334155', gap: 10,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  email: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  phone: { fontSize: 12, color: '#CBD5E1', marginTop: 2 },
  youLabel: { fontSize: 11, color: '#F59E0B', marginTop: 2, fontWeight: '600' },
  badge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  badgeText: { fontSize: 10, color: '#FBBF24', fontWeight: 'bold' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: '#334155' },
  iconBtnKey: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(96, 165, 250, 0.15)' },
  iconBtnDanger: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(185, 28, 28, 0.2)' },
  iconBtnDelete: { padding: 8, borderRadius: 8, backgroundColor: '#B91C1C' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#F8FAFC' },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 10 },
  modalInput: {
    backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155',
    borderRadius: 10, padding: 12, fontSize: 16, color: '#F8FAFC', marginTop: 6,
  },
  modalHint: { fontSize: 11, color: '#64748B', marginTop: 10 },
  modalSave: {
    backgroundColor: '#F59E0B', paddingVertical: 14,
    borderRadius: 10, alignItems: 'center', marginTop: 20,
  },
  modalSaveText: { color: '#0F172A', fontWeight: 'bold', fontSize: 16 },
});