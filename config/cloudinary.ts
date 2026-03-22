// Replace these values with your actual Cloudinary credentials
export const CLOUDINARY_CLOUD_NAME = 'dks2wwyym';
export const CLOUDINARY_UPLOAD_PRESET = 'aifoundit_uploads';
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Ask Cloudinary to deliver JPEG bytes. TensorFlow's decodeJpeg() only accepts JPEG;
 * PNG/WebP from uploads often caused "not a valid JPEG" on device.
 */
export function toCloudinaryJpegDeliveryUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('f_jpg')) return url;
  return url.replace('/upload/', '/upload/f_jpg,q_85/');
}
