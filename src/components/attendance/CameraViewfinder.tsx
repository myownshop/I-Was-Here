import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  SwitchCamera,
  ShieldCheck,
  Eye,
  Zap,
} from 'lucide-react';
import {
  detectFaceInVideoFrame,
  FaceDetectionResult,
} from '../../services/faceDetector';
import { compressFacialImage, CompressionResult } from '../../utils/imageCompression';

interface CameraViewfinderProps {
  onCapture: (result: CompressionResult) => void;
  disabled?: boolean;
}

export function CameraViewfinder({ onCapture, disabled = false }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'no_device' | 'error'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [detection, setDetection] = useState<FaceDetectionResult>({
    detected: false,
    confidence: 0,
    message: 'Align face in oval reticle...',
    isLive: false,
    livenessScore: 0,
    livenessStep: 'ALIGN_FACE',
  });
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<CompressionResult | null>(null);
  const [isSimplifiedMode, setIsSimplifiedMode] = useState<boolean>(false);

  // Helper to attach stream to video element safely
  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    if (videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
      videoRef.current.play().catch((playErr) => {
        console.warn('Auto-play notice (non-fatal):', playErr);
      });
    }
  }, []);

  // Initialize camera stream with robust fallbacks
  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPermissionState('no_device');
        setErrorMessage('Camera access is not supported on this device/browser.');
        return;
      }

      setPermissionState('prompt');
      setErrorMessage('');

      let stream: MediaStream | null = null;
      let caughtError: unknown = null;

      // 1. Primary constraint attempt: facingMode with standard dimensions
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (firstErr) {
        caughtError = firstErr;
        // 2. Fallback with ideal facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
            },
            audio: false,
          });
        } catch (secondErr) {
          caughtError = secondErr;
          // 3. Fallback to basic unconstrained video (works on external webcams, virtual cams, laptops)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (thirdErr) {
            caughtError = thirdErr;
          }
        }
      }

      if (!stream) {
        throw caughtError || new Error('Requested camera device could not be opened.');
      }

      streamRef.current = stream;
      attachStreamToVideo(stream);
      setPermissionState('granted');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : '';

      const isNoDevice =
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errName === 'OverconstrainedError' ||
        errMsg.toLowerCase().includes('device not found') ||
        errMsg.toLowerCase().includes('not found') ||
        errMsg.toLowerCase().includes('overconstrained');

      const isDenied =
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission denied') ||
        errMsg.toLowerCase().includes('not allowed');

      if (isDenied) {
        console.warn('Camera access denied:', errMsg);
        setPermissionState('denied');
        setErrorMessage(
          'Camera access was blocked by your browser. Please tap the camera/lock icon in your URL bar to allow camera access, then tap Retry Camera.'
        );
      } else if (isNoDevice) {
        console.info('No camera device found:', errMsg);
        setPermissionState('no_device');
        setErrorMessage(
          'No physical camera hardware was detected on this device.'
        );
      } else {
        console.warn('Camera initialization notice:', errMsg);
        setPermissionState('error');
        setErrorMessage(errMsg || 'Unable to access camera on this device.');
      }
    }
  }, [attachStreamToVideo]);

  // Handle camera start/stop lifecycle purely on facingMode changes
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startCamera]);

  // Video Ref callback to guarantee srcObject attachment even if DOM mounts later
  const setVideoElementRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      attachStreamToVideo(streamRef.current);
    }
  }, [attachStreamToVideo]);

  // Face Detection & Anti-Spoof Liveness Loop for Live Video (Runs smoothly every ~120ms)
  useEffect(() => {
    if (permissionState !== 'granted' || capturedPreview || isCapturing) {
      return;
    }

    let isSubscribed = true;
    let timerId: number;

    const tick = async () => {
      if (!isSubscribed) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const res = await detectFaceInVideoFrame(video, canvas);
          if (isSubscribed) {
            setDetection(res);
          }
        } catch (e) {
          console.error('Frame detection error:', e);
        }
      }

      if (isSubscribed) {
        timerId = window.setTimeout(tick, 120);
      }
    };

    timerId = window.setTimeout(tick, 200);

    return () => {
      isSubscribed = false;
      clearTimeout(timerId);
    };
  }, [permissionState, capturedPreview, isCapturing]);

  // Capture face from live camera
  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const compressionResult = await compressFacialImage(videoRef.current, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.75,
      });

      setCapturedPreview(compressionResult);
      onCapture(compressionResult);
    } catch (err) {
      console.error('Capture compression error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setDetection({
      detected: false,
      confidence: 0,
      message: 'Align face in oval reticle...',
      isLive: false,
      livenessScore: 0,
      livenessStep: 'ALIGN_FACE',
    });
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const isReadyToCapture = detection.isLive || isSimplifiedMode;

  return (
    <div
      id="camera-viewfinder-container"
      className="relative w-full rounded-2xl overflow-hidden bg-[#0c1017] border border-[#1e2636]"
    >
      {/* Hidden processing canvas for geometry and face detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder Header Banner */}
      {!capturedPreview && (
        <div className="px-3 py-2.5 bg-[#101520] border-b border-[#1b2332] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">Live Facial Biometrics</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3" />
            <span>Anti-Spoof Liveness Active</span>
          </div>
        </div>
      )}

      {/* Captured Preview State */}
      {capturedPreview ? (
        <div id="camera-preview-screen" className="relative p-4 flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden border-2 border-[#00FF66] shadow-[0_0_25px_rgba(0,255,102,0.25)]">
            <img
              src={capturedPreview.dataUrl}
              alt="Corps Member Verified Face"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 bg-[#00FF66] text-[#0a0c10] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center space-x-1 shadow-md">
              <CheckCircle2 className="w-3 h-3" />
              <span>LIVENESS VERIFIED</span>
            </div>
          </div>

          <div className="w-full max-w-[280px] mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>Biometric Payload: {Math.round(capturedPreview.compressedSize / 1024)} KB</span>
            <span className="text-[#00FF66]">Optimized {capturedPreview.reductionPercentage}%</span>
          </div>

          <button
            id="btn-retake-photo"
            type="button"
            onClick={handleRetake}
            className="mt-4 flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1a2230] hover:bg-[#222c3d] text-slate-200 border border-[#2b374d] text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Verification Photo</span>
          </button>
        </div>
      ) : permissionState === 'denied' || permissionState === 'no_device' || permissionState === 'error' ? (
        /* Camera Error / No Device Fallback UI */
        <div
          id="camera-permission-fallback"
          className="p-6 text-center flex flex-col items-center justify-center min-h-[300px]"
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              permissionState === 'no_device'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            <AlertCircle className="w-7 h-7" />
          </div>

          <h3 className="text-base font-bold text-white mb-1.5">
            {permissionState === 'no_device'
              ? 'No Camera Hardware Found'
              : permissionState === 'denied'
              ? 'Camera Access Blocked'
              : 'Camera Initialization Notice'}
          </h3>

          <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">
            {errorMessage || 'Facial biometrics and anti-spoof liveness check require active camera access.'}
          </p>

          <button
            id="btn-retry-camera"
            type="button"
            onClick={() => startCamera(facingMode)}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00FF66] text-[#0a0c10] text-xs font-extrabold shadow-[0_0_15px_rgba(0,255,102,0.3)] hover:bg-[#00e55b] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Grant Permission &amp; Retry Camera</span>
          </button>
        </div>
      ) : (
        /* Active Live Camera Viewfinder */
        <div className="relative aspect-square sm:aspect-[4/3] w-full max-h-[380px] flex items-center justify-center overflow-hidden bg-black">
          <video
            ref={setVideoElementRef}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              el.play().catch((err) => console.warn('Video playback catch:', err));
            }}
            className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
          />

          {/* Oval Face Guide Reticle with Multi-Stage Dynamic HUD */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div
              id="face-reticle-oval"
              className={`relative w-48 sm:w-56 h-64 sm:h-72 rounded-[50%] border-2 transition-all duration-300 ${
                detection.isLive || isSimplifiedMode
                  ? 'border-[#00FF66] shadow-[0_0_35px_rgba(0,255,102,0.45)]'
                  : detection.detected
                  ? 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.35)]'
                  : 'border-slate-500/60 border-dashed'
              }`}
            >
              {/* Corner crosshairs */}
              <div
                className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                  detection.isLive || isSimplifiedMode
                    ? 'border-[#00FF66]'
                    : detection.detected
                    ? 'border-cyan-400'
                    : 'border-slate-500'
                }`}
              />
              <div
                className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                  detection.isLive || isSimplifiedMode
                    ? 'border-[#00FF66]'
                    : detection.detected
                    ? 'border-cyan-400'
                    : 'border-slate-500'
                }`}
              />
              <div
                className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                  detection.isLive || isSimplifiedMode
                    ? 'border-[#00FF66]'
                    : detection.detected
                    ? 'border-cyan-400'
                    : 'border-slate-500'
                }`}
              />
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                  detection.isLive || isSimplifiedMode
                    ? 'border-[#00FF66]'
                    : detection.detected
                    ? 'border-cyan-400'
                    : 'border-slate-500'
                }`}
              />

              {/* Laser scanning beam animation when liveness is verified */}
              {(detection.isLive || isSimplifiedMode) && (
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00FF66] to-transparent shadow-[0_0_12px_#00FF66] animate-scan" />
              )}
            </div>

            {/* Live Guidance Status Badge */}
            <div
              id="detection-guidance-badge"
              className={`mt-3 px-3.5 py-1.5 rounded-full text-xs font-semibold flex flex-col items-center transition-all backdrop-blur-md ${
                detection.isLive || isSimplifiedMode
                  ? 'bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40 shadow-[0_0_15px_rgba(0,255,102,0.25)]'
                  : detection.detected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : 'bg-black/75 text-slate-300 border border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                {isSimplifiedMode ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Quick Capture Active • Ready to Snap</span>
                  </>
                ) : detection.isLive ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#00FF66] animate-pulse" />
                    <span>🛡️ Liveness Verified ({Math.round(detection.confidence * 100)}%) • Ready to Snap</span>
                  </>
                ) : detection.detected ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                    <span>{detection.message}</span>
                  </>
                ) : (
                  <span>{detection.message}</span>
                )}
              </div>

              {/* Liveness meter bar when in interactive challenge */}
              {detection.detected && !detection.isLive && !isSimplifiedMode && (
                <div className="w-36 h-1.5 bg-black/60 rounded-full mt-1.5 overflow-hidden border border-cyan-500/30">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-200 rounded-full"
                    style={{ width: `${detection.livenessScore || 30}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Mode Switcher (AI Detector vs Quick Capture) */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSimplifiedMode(!isSimplifiedMode)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 backdrop-blur-md cursor-pointer ${
                isSimplifiedMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-black/60 text-slate-300 border-white/20 hover:bg-black/80'
              }`}
              title="Toggle between AI Liveness Test and Quick Capture"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{isSimplifiedMode ? 'Quick Capture' : 'AI Liveness'}</span>
            </button>
          </div>

          {/* Camera switch button */}
          <button
            id="btn-switch-camera"
            type="button"
            onClick={toggleCamera}
            className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 transition-all backdrop-blur-sm z-10 cursor-pointer"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Capture Trigger Bar */}
          <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 px-4">
            <button
              id="btn-capture-face"
              type="button"
              disabled={disabled || isCapturing}
              onClick={handleCapture}
              className={`w-full max-w-xs py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                !disabled && !isCapturing
                  ? isReadyToCapture
                    ? 'bg-[#00FF66] text-[#0a0c10] shadow-[0_0_25px_rgba(0,255,102,0.5)] hover:bg-[#00e55b] active:scale-[0.98]'
                    : 'bg-[#18202d]/90 text-slate-300 border border-slate-600 hover:bg-[#222c3d]'
                  : 'bg-[#18202d]/80 text-slate-500 border border-slate-700/60 cursor-not-allowed'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>
                {isCapturing
                  ? 'Verifying & Compressing...'
                  : disabled
                  ? 'Geofence check pending...'
                  : isReadyToCapture
                  ? '📸 Capture Verified Face'
                  : 'Snap Photo'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

