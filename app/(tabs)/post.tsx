import { View, Text, StyleSheet } from 'react-native';

export default function PostScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Post Lost / Found Item</Text>
      <Text style={styles.sub}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  text: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 8 },
});
