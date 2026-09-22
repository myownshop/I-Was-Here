/**
 * Client-side image compression utility.
 * Optimizes facial verification captures for low-bandwidth outdoor mobile environments.
 */

export interface CompressionResult {
  blob: Blob;
  dataUrl: string;
  originalEstimatedSize: number;
  compressedSize: number;
  reductionPercentage: number;
  width: number;
  height: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/webp';
}

/**
 * Asynchronously compresses an image source (video frame, image element, or canvas)
 * to a lightweight, bandwidth-efficient JPEG/WebP.
 */
export async function compressFacialImage(
  source: CanvasImageSource,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 360,
    maxHeight = 360,
    quality = 0.72,
    format = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    try {
      let sourceWidth = 0;
      let sourceHeight = 0;

      if (source instanceof HTMLVideoElement) {
        sourceWidth = source.videoWidth;
        sourceHeight = source.videoHeight;
      } else if (source instanceof HTMLImageElement) {
        sourceWidth = source.naturalWidth || source.width;
        sourceHeight = source.naturalHeight || source.height;
      } else if (source instanceof HTMLCanvasElement) {
        sourceWidth = source.width;
        sourceHeight = source.height;
      }

      if (!sourceWidth || !sourceHeight) {
        sourceWidth = 640;
        sourceHeight = 480;
      }

      // Calculate target dimensions maintaining aspect ratio
      let targetWidth = sourceWidth;
      let targetHeight = sourceHeight;

      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        reject(new Error('Failed to obtain 2D canvas context for compression.'));
        return;
      }

      // Image enhancement for facial verification
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Center crop square or draw scaled
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      // Convert to compressed blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to generate compressed image blob.'));
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const originalEstimatedSize = sourceWidth * sourceHeight * 3; // uncompressed RGB
            const compressedSize = blob.size;
            const reductionPercentage = Math.max(
              0,
              Math.round(((originalEstimatedSize - compressedSize) / originalEstimatedSize) * 100)
            );

            resolve({
              blob,
              dataUrl,
              originalEstimatedSize,
              compressedSize,
              reductionPercentage,
              width: targetWidth,
              height: targetHeight,
            });
          };
          reader.onerror = () => reject(new Error('Failed to read compressed blob as data URL.'));
          reader.readAsDataURL(blob);
        },
        format,
        quality
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Unexpected error during image compression.'));
    }
  });
}

/**
 * Calculates compression stats for display.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
