import './polyfill';
import * as tf from '@tensorflow/tfjs';
// Side-effect: registers RN fetch + rn-webgl backend (needed for MobileNet on device)
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { toCloudinaryJpegDeliveryUrl } from '@/config/cloudinary';

let model: mobilenet.MobileNet | null = null;

/** Single-flight init: decodeJpeg/infer need rn-webgl (or cpu) ready *before* any tensor ops. */
let tfBackendReady: Promise<void> | null = null;

async function ensureTfBackend(): Promise<void> {
  if (!tfBackendReady) {
    tfBackendReady = (async () => {
      try {
        await tf.setBackend('rn-webgl');
      } catch {
        await tf.setBackend('cpu');
      }
      await tf.ready();
    })();
  }
  await tfBackendReady;
}

const isJpegMagic = (raw: Uint8Array) =>
  raw.length > 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;

const loadModel = async () => {
  await ensureTfBackend();
  if (!model) {
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
  }
  return model;
};

// Extracted AI Embedding instead of raw byte hash
const getImageEmbedding = async (imageUrl: string): Promise<tf.Tensor | null> => {
  // 1. UNIQUE FILENAME to prevent race condition when Promise.all is used
  const uniqueId = Math.random().toString(36).substring(7) + Date.now();
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  const localUri = `${baseDir}image_${uniqueId}.jpg`;

  try {
    const fetchUrl = toCloudinaryJpegDeliveryUrl(imageUrl);
    await FileSystem.downloadAsync(fetchUrl, localUri);

    let readUri = localUri;
    let imgB64 = await FileSystem.readAsStringAsync(readUri, { encoding: FileSystem.EncodingType.Base64 });
    let raw = new Uint8Array(tf.util.encodeString(imgB64, 'base64').buffer);

    if (!isJpegMagic(raw)) {
      const converted = await manipulateAsync(localUri, [], {
        compress: 0.92,
        format: SaveFormat.JPEG,
      });
      readUri = converted.uri;
      imgB64 = await FileSystem.readAsStringAsync(readUri, { encoding: FileSystem.EncodingType.Base64 });
      raw = new Uint8Array(tf.util.encodeString(imgB64, 'base64').buffer);
    }

    await ensureTfBackend();
    const imageTensor = decodeJpeg(raw);

    const loadedModel = await loadModel();

    const embedding = loadedModel.infer(imageTensor, true);
    tf.dispose(imageTensor);

    return embedding;
  } catch (err) {
    console.error('Failed to generate embedding for image:', err);
    return null;
  } finally {
    // 3. STORAGE LEAK FIX: ALWAYS clean up the temporary file, even on failure
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch (e) {
      console.warn('Cleanup error for', localUri, e);
    }
  }
};

const cosineSimilarity = (a: tf.Tensor, b: tf.Tensor): number => {
  return tf.tidy(() => {
    // Calculate Cosine Similarity: (A • B) / (||A|| * ||B||)
    const dot = tf.sum(tf.mul(a, b));
    const magA = tf.norm(a);
    const magB = tf.norm(b);
    
    // Note: dataSync() transfers the result from GPU/Tensor logic back to JS float
    const similarityTensor = dot.div(magA.mul(magB));
    const similarity = similarityTensor.dataSync()[0];
    
    return similarity;
  });
};

export const compareImages = async (url1: string, url2: string): Promise<number> => {
  let emb1: tf.Tensor | null = null;
  let emb2: tf.Tensor | null = null;
  try {
    [emb1, emb2] = await Promise.all([getImageEmbedding(url1), getImageEmbedding(url2)]);
    if (!emb1 || !emb2) return 0;
    return cosineSimilarity(emb1, emb2);
  } catch (error) {
    console.error("Image similarity error:", error);
    return 0;
  } finally {
    if (emb1) tf.dispose(emb1);
    if (emb2) tf.dispose(emb2);
  }
};

/** Compare all pairs from two image URL arrays, return the highest similarity score (0–1). */
export const compareMultipleImages = async (urls1: string[], urls2: string[]): Promise<number> => {
  if (!urls1.length || !urls2.length) return 0;
  let best = 0;
  for (const u1 of urls1) {
    for (const u2 of urls2) {
      const score = embeddingSimilarityTo01(await compareImages(u1, u2));
      if (score > best) best = score;
    }
  }
  return best;
};

const SYNONYMS: Record<string, string> = {
  backpack: 'bag', pouch: 'bag', purse: 'bag',
  billfold: 'wallet',
  cellphone: 'phone', mobile: 'phone',
  spectacles: 'glasses', eyeglasses: 'glasses',
};

// Jaccard similarity on word tokens
export const compareText = (a: string, b: string): number => {
  if (!a || !b) return 0;

  const tokenize = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
      .map((w) => SYNONYMS[w] ?? w)
  );
  const setA = tokenize(a);
  const setB = tokenize(b);
  
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  
  return union === 0 ? 0 : intersection / union;
};

/** Maps cosine similarity from MobileNet embeddings to 0–1 for weighting with text scores. */
export function embeddingSimilarityTo01(sim: number): number {
  if (!Number.isFinite(sim)) return 0;
  if (sim >= 0 && sim <= 1) return sim;
  return Math.max(0, Math.min(1, (sim + 1) / 2));
}

/** Final 0–100 confidence for UI (combined score is 0–1). */
export function combinedScoreToPercent(combined01: number): number {
  return Math.round(Math.max(0, Math.min(1, combined01)) * 100);
}
