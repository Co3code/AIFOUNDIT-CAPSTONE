// This runs before anything else to prevent Web SSR crashing over TensorFlow JS
if (typeof navigator === 'undefined') {
  (global as any).navigator = { userAgent: 'node' };
}
if (typeof window === 'undefined') {
  (global as any).window = {};
}
