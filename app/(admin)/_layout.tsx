import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace('/(auth)/login');
        return;
      }
      const snap = await getDoc(doc(db, 'users', u.uid));
      const role = snap.exists() ? snap.data().role : 'user';
      if (role !== 'admin') {
        router.replace('/(tabs)');
        return;
      }
      setChecking(false);
    });
    return unsubscribe;
  }, []);

  if (checking) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color="#2563EB" /></View>;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
