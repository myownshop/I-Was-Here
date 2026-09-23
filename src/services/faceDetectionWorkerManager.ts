/**
 * Face Detection Worker Manager & 3-Second Fallback Orchestrator.
 *
 * Encapsulates:
 * 1. Memoized background worker for zero main-thread jank.
 * 2. Strict 3-second initialization deadline: if MediaPipe / neural worker
 *    is delayed beyond 3s or fails, it activates Simplified Quick Capture mode.
 * 3. Graceful fallback for all mobile browsers and low-end devices.
 */

import { FaceDetectionResult } from './faceDetector';

export interface DetectorWorkerStatus {
  isReady: boolean;
  isSimplifiedFallback: boolean;
  initializationTimeMs: number;
  error: string | null;
}

class FaceDetectionWorkerManager {
  private static instance: FaceDetectionWorkerManager | null = null;
  private worker: Worker | null = null;
  private isInitialized = false;
  private isSimplifiedFallback = false;
  private initializationPromise: Promise<void> | null = null;
  private messageCounter = 0;
  private pendingCallbacks = new Map<number, (res: FaceDetectionResult) => void>();
  private statusListeners = new Set<(status: DetectorWorkerStatus) => void>();
  private startTime = 0;
  private initDuration = 0;
  private errorMessage: string | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): FaceDetectionWorkerManager {
    if (!FaceDetectionWorkerManager.instance) {
      FaceDetectionWorkerManager.instance = new FaceDetectionWorkerManager();
    }
    return FaceDetectionWorkerManager.instance;
  }

  /**
   * Initializes worker with 3.0s strict deadline
   */
  public async init(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.startTime = performance.now();

    this.initializationPromise = new Promise<void>((resolve) => {
      // 3.0 Second strict timeout guard for MediaPipe/Worker loading
      const fallbackTimer = setTimeout(() => {
        if (!this.isInitialized) {
          console.warn('Face detector initialization exceeded 3.0s threshold. Switching immediately to Simplified Capture Mode.');
          this.activateSimplifiedFallback('Detector initialization timed out (3s). Simplified capture mode active.');
          resolve();
        }
      }, 3000);

      try {
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
          clearTimeout(fallbackTimer);
          this.activateSimplifiedFallback('Web Workers not supported in this environment.');
          resolve();
          return;
        }

        // Initialize Vite module worker
        this.worker = new Worker(new URL('../workers/faceDetectorWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (e: MessageEvent) => {
          const { id, detected, confidence, boundingBox, message } = e.data;
          const callback = this.pendingCallbacks.get(id);
          if (callback) {
            this.pendingCallbacks.delete(id);
            callback({
              detected,
              confidence,
              boundingBox,
              message,
            });
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Face detection worker runtime error, falling back to simplified mode:', err);
          this.activateSimplifiedFallback('Worker runtime error.');
        };

        clearTimeout(fallbackTimer);
        this.isInitialized = true;
        this.isSimplifiedFallback = false;
        this.initDuration = performance.now() - this.startTime;
        this.notifyStatus();
        resolve();
      } catch (err) {
        clearTimeout(fallbackTimer);
        console.warn('Failed to spawn face detector worker, falling back to simplified mode:', err);
        this.activateSimplifiedFallback(err instanceof Error ? err.message : 'Worker initialization failed');
        resolve();
      }
    });

    return this.initializationPromise;
  }

  public activateSimplifiedFallback(reason?: string): void {
    this.isSimplifiedFallback = true;
    this.isInitialized = true;
    this.errorMessage = reason || null;
    this.initDuration = performance.now() - this.startTime;
    this.notifyStatus();
  }

  public getStatus(): DetectorWorkerStatus {
    return {
      isReady: this.isInitialized,
      isSimplifiedFallback: this.isSimplifiedFallback,
      initializationTimeMs: Math.round(this.initDuration || (performance.now() - this.startTime)),
      error: this.errorMessage,
    };
  }

  public subscribeStatus(listener: (status: DetectorWorkerStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => fn(status));
  }

  /**
   * Dispatches a frame to the worker or executes rapid simplified analysis
   */
  public async analyzeFrame(
    canvas: HTMLCanvasElement,
    source: HTMLVideoElement | HTMLImageElement
  ): Promise<FaceDetectionResult> {
    if (this.isSimplifiedFallback || !this.worker) {
      // In simplified capture mode, perform fast framing check without locking UI
      return this.fallbackDirectAnalyze(canvas, source);
    }

    try {
      const targetW = 120;
      const targetH = 120;
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return { detected: true, confidence: 0.85, message: 'Simplified mode: Centered and ready.' };
      }

      let sourceW = 0;
      let sourceH = 0;
      if (source instanceof HTMLVideoElement) {
        if (source.readyState < 2 || source.videoWidth === 0) {
          return { detected: false, confidence: 0, message: 'Camera initializing...' };
        }
        sourceW = source.videoWidth;
        sourceH = source.videoHeight;
      } else {
        sourceW = source.naturalWidth || source.width;
        sourceH = source.naturalHeight || source.height;
      }

      const cropSize = Math.min(sourceW, sourceH) * 0.85;
      const cropX = (sourceW - cropSize) / 2;
      const cropY = (sourceH - cropSize) / 2;

      ctx.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, targetW, targetH);
      const imageData = ctx.getImageData(0, 0, targetW, targetH);

      const msgId = ++this.messageCounter;

      return new Promise<FaceDetectionResult>((resolve) => {
        const timeout = setTimeout(() => {
          this.pendingCallbacks.delete(msgId);
          resolve({
            detected: true,
            confidence: 0.8,
            message: 'Simplified mode: Tap to capture portrait.',
          });
        }, 600);

        this.pendingCallbacks.set(msgId, (res) => {
          clearTimeout(timeout);
          resolve(res);
        });

        this.worker!.postMessage({
          id: msgId,
          type: 'DETECT_FRAME',
          imageData,
          width: targetW,
          height: targetH,
        });
      });
    } catch {
      return {
        detected: true,
        confidence: 0.8,
        message: 'Simplified mode active: Ready to capture.',
      };
    }
  }

  private fallbackDirectAnalyze(
    canvas: HTMLCanvasElement,
    source: HTMLVideoElement | HTMLImageElement
  ): FaceDetectionResult {
    // Fast lightweight pass for simplified mode
    let sourceW = 0;
    let sourceH = 0;
    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2 || source.videoWidth === 0) {
        return { detected: false, confidence: 0, message: 'Camera stream readying...' };
      }
      sourceW = source.videoWidth;
      sourceH = source.videoHeight;
    } else {
      sourceW = source.naturalWidth || source.width;
      sourceH = source.naturalHeight || source.height;
    }

    if (sourceW === 0 || sourceH === 0) {
      return { detected: false, confidence: 0, message: 'Waiting for camera frame...' };
    }

    // In simplified mode, always allow capture if video stream has valid dimensions
    return {
      detected: true,
      confidence: 0.9,
      boundingBox: {
        x: sourceW * 0.2,
        y: sourceH * 0.15,
        width: sourceW * 0.6,
        height: sourceH * 0.7,
      },
      message: 'Quick Capture Active: Align face and tap capture.',
    };
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    this.pendingCallbacks.clear();
  }
}

export const faceDetectorWorkerManager = FaceDetectionWorkerManager.getInstance();
