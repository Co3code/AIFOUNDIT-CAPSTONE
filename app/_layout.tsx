import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        setRole(snap.exists() ? snap.data().role ?? 'user' : 'user');
        setUser(u);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      {!user && <Redirect href="/(auth)/login" />}
      {user && role === 'admin' && <Redirect href="/(admin)" />}
      {user && role === 'user' && <Redirect href="/(tabs)" />}
      <StatusBar style="auto" />
    </>
  );
}
