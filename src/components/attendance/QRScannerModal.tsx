import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera,
  RotateCcw,
  Flashlight,
  Upload,
  AlertTriangle,
  QrCode,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import jsQR from 'jsqr';
import { extractCodeFromQR, ParsedQRResult } from '../../utils/qrParser';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (result: ParsedQRResult) => void;
  accentColor?: string;
  title?: string;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  accentColor = '#00FF66',
  title = 'Scan Session QR Code',
}: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<ParsedQRResult | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  // Play a pleasant feedback sound upon successful QR detection
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not permitted or supported; silent fallback
    }

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 30, 80]);
      }
    } catch {
      // Haptics unsupported
    }
  }, []);

  const handleValidCodeDetected = useCallback(
    (codeText: string) => {
      if (scannedResult) return; // Prevent multiple rapid firings
      const parsed = extractCodeFromQR(codeText);
      setScannedResult(parsed);
      playSuccessChime();

      // Short delay for visual checkmark before firing success
      setTimeout(() => {
        onScanSuccess(parsed);
      }, 350);
    },
    [scannedResult, playSuccessChime, onScanSuccess]
  );

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Frame scanning loop using requestAnimationFrame + jsQR
  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      handleValidCodeDetected(code.data);
      return; // Stop scan loop on success
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [handleValidCodeDetected]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasPermission(false);
      setCameraError('Camera API is not supported on this browser.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setHasPermission(true);
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setHasPermission(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setCameraError('Camera access was blocked. Please enable camera permissions in your browser or upload an image.');
      } else {
        setCameraError('Could not start camera. You can still scan by uploading an image below.');
      }
    }
  }, [facingMode, scanLoop, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle front/back camera
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Toggle torch/flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current || !torchAvailable) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Decode QR code from uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsProcessingFile(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          handleValidCodeDetected(code.data);
        } else {
          setCameraError('No valid QR code was detected in the uploaded image. Please try another photo.');
        }
        setIsProcessingFile(false);
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#0e121a] border border-[#212c3e] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1b2332] bg-[#111722]">
          <div className="flex items-center space-x-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Aim camera at roll call session QR code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#18212e] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Viewport */}
        <div className="relative bg-black aspect-square w-full overflow-hidden flex items-center justify-center">
          {/* Video Stream */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Hidden Canvas for Decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanned Success Overlay */}
          {scannedResult && (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 z-30 animate-in fade-in zoom-in-95 duration-150">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg"
                style={{
                  backgroundColor: `${accentColor}25`,
                  borderColor: accentColor,
                  color: accentColor,
                }}
              >
                <CheckCircle className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Code Detected!
              </span>
              <span className="text-xs font-mono font-bold text-[#00FF66] px-3 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30">
                {scannedResult.code.toUpperCase()}
              </span>
            </div>
          )}

          {/* Animated Scanning Frame & Reticle */}
          {hasPermission && !scannedResult && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Semi-transparent dark vignette mask */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-white/20">
                {/* 4 Glowing Corner Brackets */}
                <div
                  className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg"
                  style={{ borderColor: accentColor }}
                />
                <div
                  className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg"
                  style={{ borderColor: accentColor }}
                />
                <div
                  className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg"
                  style={{ borderColor: accentColor }}
                />
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-lg"
                  style={{ borderColor: accentColor }}
                />

                {/* Laser Sweep Animation Line */}
                <div
                  className="absolute inset-x-2 h-0.5 shadow-[0_0_15px_rgba(0,255,102,0.8)] animate-pulse"
                  style={{
                    backgroundColor: accentColor,
                    animation: 'scannerSweep 2s ease-in-out infinite alternate',
                  }}
                />
              </div>

              {/* Helper badge */}
              <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-white/90 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-md">
                  Align QR code inside the box
                </span>
              </div>
            </div>
          )}

          {/* Error / Permission Blocked Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-[#0e121a] p-6 flex flex-col items-center justify-center text-center gap-3 z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-[#1b2536] text-white text-xs font-bold hover:bg-[#253246] transition-colors cursor-pointer"
              >
                Try Camera Again
              </button>
            </div>
          )}
        </div>

        {/* Viewport Control Actions */}
        <div className="p-4 bg-[#111722] border-t border-[#1b2332] flex items-center justify-between gap-3">
          {/* File Upload Alternative */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#18212e] hover:bg-[#202b3c] text-slate-200 text-xs font-bold border border-[#263347] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Scan an image or screenshot of the QR code"
          >
            {isProcessingFile ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Upload QR Image</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Camera Flip */}
          <button
            type="button"
            onClick={handleFlipCamera}
            className="p-2.5 rounded-xl bg-[#18212e] hover:bg-[#202b3c] text-slate-200 border border-[#263347] transition-colors cursor-pointer"
            title="Switch front/back camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Torch toggle if available */}
          {torchAvailable && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                torchOn
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-[#18212e] hover:bg-[#202b3c] text-slate-200 border-[#263347]'
              }`}
              title="Toggle flashlight"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Embedded CSS for smooth scanner sweep */}
      <style>{`
        @keyframes scannerSweep {
          0% { top: 12%; }
          100% { top: 88%; }
        }
      `}</style>
    </div>
  );
}
