import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { CLOUDINARY_UPLOAD_URL, CLOUDINARY_UPLOAD_PRESET } from '@/config/cloudinary';

export default function PostScreen() {
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission required', 'Camera permission is needed');
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const uploadImage = async (uri: string) => {
    const formData = new FormData();
    formData.append('file', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async () => {
    if (!title || !description || !location || !image)
      return Alert.alert('Error', 'Please fill in all fields and add an image');
    setLoading(true);
    try {
      const imageUrl = await uploadImage(image);
      await addDoc(collection(db, 'posts'), {
        type,
        title,
        description,
        location,
        imageUrl,
        postedBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Post submitted successfully!');
      setTitle('');
      setDescription('');
      setLocation('');
      setImage(null);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Item</Text>
        <Text style={styles.subtitle}>Lost or found something?</Text>
      </View>

      {/* Type Selector */}
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'lost' && styles.typeBtnActiveLost]}
          onPress={() => setType('lost')}>
          <Text style={[styles.typeBtnText, type === 'lost' && { color: '#fff' }]}>Lost</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'found' && styles.typeBtnActiveFound]}
          onPress={() => setType('found')}>
          <Text style={[styles.typeBtnText, type === 'found' && { color: '#fff' }]}>Found</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {/* Image Picker */}
        <Text style={styles.label}>Photo</Text>
        {image ? (
          <TouchableOpacity onPress={pickImage}>
            <Image source={{ uri: image }} style={styles.imagePreview} />
          </TouchableOpacity>
        ) : (
          <View style={styles.imageButtons}>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={22} color="#2563EB" />
              <Text style={styles.imageBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={22} color="#2563EB" />
              <Text style={styles.imageBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Item Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Black Wallet" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Describe the item..."
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} placeholder="Where was it lost/found?" value={location} onChangeText={setLocation} />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Post</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { padding: 24, paddingTop: 56, backgroundColor: '#2563EB' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  typeRow: { flexDirection: 'row', margin: 24, gap: 12 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
  typeBtnActiveLost: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  typeBtnActiveFound: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  typeBtnText: { fontWeight: 'bold', color: '#6B7280' },
  form: { paddingHorizontal: 24, gap: 6, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12 },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 16 },
  imageBtnText: { color: '#2563EB', fontWeight: '600' },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  submitBtn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
