import { CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_UPLOAD_URL } from "@/config/cloudinary";
import { auth, db } from "@/config/firebase";
import { combinedScoreToPercent, compareMultipleImages, compareText } from "@/config/similarity";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── FIX 1: Deduplicated upsert — one doc per postId, no duplicates ──────────
async function upsertMatchEntry(postId: string, otherPostId: string, score: number) {
  const q = query(collection(db, "matches"), where("postId", "==", postId));
  const snap = await getDocs(q);
  const entry = { postId: otherPostId, score };

  if (snap.empty) {
    // No existing doc for this postId → create one
    await addDoc(collection(db, "matches"), {
      postId,
      matches: [entry],
      createdAt: serverTimestamp(),
    });
    return;
  }

  const matchDoc = snap.docs[0];
  const existing: { postId: string; score: number }[] = matchDoc.data().matches || [];
  const idx = existing.findIndex((x) => x.postId === otherPostId);

  const next =
    idx >= 0
      ? existing.map((x, i) => (i === idx ? { ...x, score: Math.max(x.score, score) } : x))
      : [...existing, entry];

  // Use setDoc with merge to safely update
  await setDoc(doc(db, "matches", matchDoc.id), { matches: next }, { merge: true });
}

export default function PostScreen() {
  const CATEGORIES = ["bag", "phone", "wallet", "glasses", "keys", "clothing", "electronics", "other"];

  const [type, setType] = useState<"lost" | "found">("lost");
  const [category, setCategory] = useState("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission required", "Camera permission is needed");
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" } as any);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Image upload failed");
    return data.secure_url;
  };

  const computeScore = async (
    newPost: { imageUrls: string[]; description: string; location: string; title: string; category: string },
    otherPost: any,
  ): Promise<number> => {
    // Skip only if both posts have a category and they don't match
    const bothHaveCategory = !!newPost.category && !!otherPost.category;
    if (bothHaveCategory && newPost.category !== otherPost.category) return 0;

    const urls1 = newPost.imageUrls ?? [];
    const urls2: string[] = otherPost.imageUrls ?? (otherPost.imageUrl ? [otherPost.imageUrl] : []);
    const hasImages = urls1.length > 0 && urls2.length > 0;

    const imageScore01 = hasImages ? await compareMultipleImages(urls1, urls2) : 0;
    const descScore = compareText(newPost.description, otherPost.description ?? "");
    const locScore = compareText(newPost.location, otherPost.location ?? "");
    const titleScore = compareText(newPost.title, otherPost.title ?? "");

    const combined = hasImages
      ? imageScore01 * 0.3 + descScore * 0.3 + locScore * 0.25 + titleScore * 0.15
      : descScore * 0.45 + locScore * 0.4 + titleScore * 0.15;

    return combinedScoreToPercent(combined);
  };

    type ConcurrentTask<T> = () => Promise<T>;
  type ScoreResult = { id: string; post: Record<string, any>; score: number; matchLabel: string };

  const runWithConcurrency = async <T,>(tasks: ConcurrentTask<T>[], limit: number): Promise<T[]> => {
    const results: T[] = [];
    for (let i = 0; i < tasks.length; i += limit) {
      const batch = tasks.slice(i, i + limit).map((t) => t());
      results.push(...(await Promise.all(batch)));
    }
    return results;
  };

  const findMatches = async (
    newImageUrls: string[],
    newPost: { type: string; description: string; location: string; title: string; category: string },
    currentUid: string,
    newPostId: string,
  ) => {
    const oppositeType = newPost.type === "lost" ? "found" : "lost";
    const snap = await getDocs(query(collection(db, "posts"), where("type", "==", oppositeType)));

    const candidates = snap.docs.filter((d) => {
      const data = d.data();
      if (data.postedBy === currentUid) return false;
      const bothHaveCategory = !!newPost.category && !!data.category;
      if (bothHaveCategory && data.category !== newPost.category) return false;
      return true;
    });

    const tasks = candidates.map((docSnap) => async () => {
      const post = docSnap.data();
      const score = await computeScore({ imageUrls: newImageUrls, ...newPost }, post);
      const matchLabel = score >= 80 ? "strong match" : "possible match";
      return { id: docSnap.id, post, score, matchLabel };
    });

    const scoreResults = await runWithConcurrency<ScoreResult>(tasks, 3);

    const THRESHOLD = 60;
    return scoreResults.filter((r) => r.score >= THRESHOLD).sort((a, b) => b.score - a.score);
  };

  const handleSubmit = async () => {
    if (!title || !description || !location)
      return Alert.alert("Error", "Please fill in all fields");

    setLoading(true);
    try {
      setStatusMsg("Uploading images...");
      const imageUrls = await Promise.all(images.map((uri) => uploadImage(uri)));

      setStatusMsg("Saving post...");
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not signed in");

      const docRef = await addDoc(collection(db, "posts"), {
        type,
        category,
        title,
        description,
        location,
        imageUrls,
        postedBy: uid,
        createdAt: serverTimestamp(),
      });

      setStatusMsg("Finding matches... (this may take a moment)");
      const matches = await findMatches(imageUrls, { type, category, description, location, title }, uid, docRef.id);

      // ─── FIX 4: Write matches ONCE via upsertMatchEntry only — no double addDoc ─
      if (matches.length > 0) {
        await upsertMatchEntry(docRef.id, matches[0].id, matches[0].score);
        for (let i = 1; i < matches.length; i++) {
          await upsertMatchEntry(docRef.id, matches[i].id, matches[i].score);
        }
        for (const m of matches) {
          await upsertMatchEntry(m.id, docRef.id, m.score);
        }

        // Save notifications
        const notifPromises: Promise<any>[] = [];

        // Notify current user
        notifPromises.push(addDoc(collection(db, 'notifications'), {
          userId: uid,
          title: 'Match Found',
          message: `We found ${matches.length} possible match${matches.length > 1 ? 'es' : ''} for your item "${title}".`,
          postId: docRef.id,
          read: false,
          createdAt: serverTimestamp(),
        }));

        // Notify each matched post owner
        for (const m of matches) {
          if (m.post.postedBy && m.post.postedBy !== uid) {
            notifPromises.push(addDoc(collection(db, 'notifications'), {
              userId: m.post.postedBy,
              title: 'Possible Match Found',
              message: `Someone posted "${title}" that may match your "${m.post.title}".`,
              postId: m.id,
              read: false,
              createdAt: serverTimestamp(),
            }));
          }
        }

        await Promise.all(notifPromises);

        Alert.alert('Match Found!', `We found ${matches.length} possible match${matches.length > 1 ? 'es' : ''} for your item! Check the Matches tab.`);
      } else {
        Alert.alert('Post Submitted', "No matches yet. We'll notify you when one is found.");
      }

      setTitle("");
      setDescription("");
      setLocation("");
      setImages([]);
      setCategory("other");
      setType("lost");
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Report Item</Text>
        <Text style={styles.subtitle}>Lost or found something?</Text>
      </View>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === "lost" && styles.typeBtnActiveLost]}
          onPress={() => setType("lost")}
        >
          <Ionicons name="search-outline" size={16} color={type === "lost" ? "#fff" : "#6B7280"} />
          <Text style={[styles.typeBtnText, type === "lost" && { color: "#fff" }]}>Lost</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === "found" && styles.typeBtnActiveFound]}
          onPress={() => setType("found")}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={type === "found" ? "#fff" : "#6B7280"} />
          <Text style={[styles.typeBtnText, type === "found" && { color: "#fff" }]}>Found</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.categoryBtn, category === c && styles.categoryBtnActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.categoryBtnText, category === c && { color: "#fff" }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Photos</Text>
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
        {images.length > 0 && (
          <View style={styles.imageRow}>
            {images.map((uri, i) => (
              <TouchableOpacity key={i} onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                <Image source={{ uri }} style={styles.imageThumbnail} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Item Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Black Wallet"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Describe the item in detail..."
          placeholderTextColor="#9CA3AF"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Where was it lost/found?"
          placeholderTextColor="#9CA3AF"
          value={location}
          onChangeText={setLocation}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitText}>{statusMsg || "Processing..."}</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Submit Post</Text>
          )}
        </TouchableOpacity>

        {loading && <Text style={styles.loadingHint}>AI matching is running in the background. Please wait...</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { padding: 24, paddingTop: 56, backgroundColor: "#2563EB" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#BFDBFE", marginTop: 2 },
  typeRow: { flexDirection: "row", margin: 24, gap: 12 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  typeBtnActiveLost: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  typeBtnActiveFound: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  typeBtnText: { fontWeight: "bold", color: "#6B7280" },
  form: { paddingHorizontal: 24, gap: 6, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 8 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    color: "#111827",
  },
  imageButtons: { flexDirection: "row", gap: 12 },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  imageThumbnail: { width: 80, height: 80, borderRadius: 8 },
  imageBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 16,
  },
  imageBtnText: { color: "#2563EB", fontWeight: "600" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  categoryBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  categoryBtnText: { fontSize: 12, fontWeight: "600", color: "#6B7280", textTransform: "capitalize" },
  imagePreview: { width: "100%", height: 200, borderRadius: 12 },
  changePhoto: { textAlign: "center", color: "#6B7280", fontSize: 12, marginTop: 6 },
  submitBtn: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    minHeight: 50,
    justifyContent: "center",
  },
  submitBtnDisabled: { backgroundColor: "#93C5FD" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  loadingHint: { textAlign: "center", color: "#9CA3AF", fontSize: 12, marginTop: 8 },
});
