import { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  accentColor?: string;
  className?: string;
}

export function PWAInstallButton({ accentColor = '#00FF66', className = '' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running standalone, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0a0c10] shadow-md transition-all active:scale-95 ${className}`}
        style={{ backgroundColor: accentColor }}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install PWA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 active:scale-95 transition-all ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-300" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0f141c] border border-slate-800 p-6 shadow-2xl relative text-left">
              <button
                id="btn-close-ios-guide"
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#0a0c10]"
                  style={{ backgroundColor: accentColor }}
                >
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install IWasHere on iPhone</h3>
                  <p className="text-xs text-slate-400">Offline PWA with instant launch</p>
                </div>
              </div>

              <div className="space-y-3 my-4 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="font-bold text-white w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">1</span>
                  <p className="leading-snug">
                    Tap the <strong className="text-white inline-flex items-center gap-1">Share <Share2 className="w-3 h-3 text-sky-400" /></strong> icon in the Safari bottom toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="font-bold text-white w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">2</span>
                  <p className="leading-snug">
                    Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                  <span className="font-bold text-white w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">3</span>
                  <p className="leading-snug">
                    Tap <strong className="text-white">"Add"</strong> in the top right. Launch directly from your home screen even with no data!
                  </p>
                </div>
              </div>

              <button
                id="btn-dismiss-ios-guide"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl font-semibold text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
