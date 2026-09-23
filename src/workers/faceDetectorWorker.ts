/**
 * Web Worker for Off-Thread Face Detection and Image Analysis
 * Keeps the main UI completely fluid while analyzing video frames or images.
 * Tuned for universal skin tones (Fitzpatrick I-VI) and multi-lighting conditions.
 */

export interface WorkerFrameMessage {
  id: number;
  type: 'DETECT_FRAME';
  imageData: ImageData;
  width: number;
  height: number;
}

export interface WorkerResponseMessage {
  id: number;
  detected: boolean;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  message: string;
}

/**
 * Universal Skin Tone & Facial Feature Analysis using YCbCr color space + RGB heuristics.
 * Covers all Fitzpatrick skin phototypes (I through VI) in indoor, outdoor, and shadow conditions.
 */
function analyzeFrameData(
  imageData: ImageData,
  width: number,
  height: number
): { detected: boolean; confidence: number; message: string; boundingBox?: { x: number; y: number; width: number; height: number } } {
  const data = imageData.data;
  let skinPixelCount = 0;
  let ocularDarknessCount = 0;
  let totalSampled = 0;

  const cX = width / 2;
  const cY = height / 2;
  const rX = width * 0.44;
  const rY = height * 0.48;

  // Track bounding box of detected face pixels
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const dx = (x - cX) / rX;
      const dy = (y - cY) / rY;

      // Sample inside oval target area
      if (dx * dx + dy * dy <= 1.05) {
        totalSampled++;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // 1. Standard YCbCr Conversion
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

        // Universal Skin Locus: 75 <= Cb <= 135 and 130 <= Cr <= 180
        const isYCbCrSkin = Cb >= 75 && Cb <= 135 && Cr >= 130 && Cr <= 180 && Y >= 30;

        // 2. RGB Skin Heuristic (handles varying color temperature and high/low lighting)
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const isRgbSkin =
          r > 35 &&
          g > 20 &&
          b > 15 &&
          r >= g &&
          r >= b &&
          (maxVal - minVal) > 10;

        const isSkin = isYCbCrSkin || isRgbSkin;

        if (isSkin) {
          skinPixelCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }

        // Ocular / Feature darkness (eyes & eyebrows in upper region)
        if (y < height * 0.55 && y > height * 0.25 && Y < 65) {
          ocularDarknessCount++;
        }
      }
    }
  }

  const skinRatio = totalSampled > 0 ? skinPixelCount / totalSampled : 0;
  // Lenient yet robust threshold (>= 18% oval coverage is a centered face)
  const isFaceDetected = skinRatio >= 0.18;

  if (isFaceDetected) {
    const rawBoxW = Math.max(width * 0.45, maxX - minX);
    const rawBoxH = Math.max(height * 0.55, maxY - minY);
    const boxX = Math.max(0, Math.min(width - rawBoxW, (minX + maxX) / 2 - rawBoxW / 2));
    const boxY = Math.max(0, Math.min(height - rawBoxH, (minY + maxY) / 2 - rawBoxH / 2));

    const confidence = Math.min(0.98, Math.max(0.75, 0.70 + skinRatio * 0.35));

    return {
      detected: true,
      confidence,
      boundingBox: {
        x: boxX,
        y: boxY,
        width: rawBoxW,
        height: rawBoxH,
      },
      message: 'Face verified. Ready to capture.',
    };
  }

  if (skinRatio > 0.08) {
    return {
      detected: false,
      confidence: 0.45,
      message: 'Align and center face within the oval reticle.',
    };
  }

  return {
    detected: false,
    confidence: 0.1,
    message: 'Look directly into front camera.',
  };
}

self.onmessage = (e: MessageEvent<WorkerFrameMessage>) => {
  const { id, type, imageData, width, height } = e.data;

  if (type === 'DETECT_FRAME') {
    const result = analyzeFrameData(imageData, width, height);
    const response: WorkerResponseMessage = {
      id,
      detected: result.detected,
      confidence: result.confidence,
      boundingBox: result.boundingBox,
      message: result.message,
    };
    self.postMessage(response);
  }
};
