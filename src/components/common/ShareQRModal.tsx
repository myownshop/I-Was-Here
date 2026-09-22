import { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Printer,
  Smartphone,
  MessageCircle,
  Send,
  ExternalLink,
} from 'lucide-react';
import { showToast } from './Toast';

interface ShareQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  shareUrl: string;
  shortCode?: string;
  qrDataUrl?: string;
  accentColor?: string;
}

export function ShareQRModal({
  isOpen,
  onClose,
  title,
  subtitle,
  shareUrl,
  shortCode,
  qrDataUrl,
  accentColor = '#00FF66',
}: ShareQRModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('success', 'Link copied to clipboard!', 'Copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('error', 'Could not copy link.', 'Error');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        // If file sharing is supported and qrDataUrl exists
        if (qrDataUrl && navigator.canShare) {
          try {
            const blob = await (await fetch(qrDataUrl)).blob();
            const file = new File([blob], `Attendance_QR_${shortCode || 'Code'}.png`, {
              type: 'image/png',
            });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title,
                text: `${title}\nScan QR code or click link to sign attendance:`,
                url: shareUrl,
                files: [file],
              });
              return;
            }
          } catch {
            // fallback to link share
          }
        }

        await navigator.share({
          title,
          text: `${title} - Sign physical attendance:`,
          url: shareUrl,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          showToast('info', 'Share cancelled or not completed.');
        }
      }
    } else {
      handleCopy();
    }
  };

  const shareText = encodeURIComponent(
    `*${title}*\n${subtitle ? subtitle + '\n' : ''}Scan the QR code or click this secure link to verify attendance:\n${shareUrl}`
  );

  const handleWhatsAppShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `Attendance_QR_${shortCode || 'RollCall'}.png`;
    a.click();
    showToast('success', 'QR code image downloaded.', 'Downloaded');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('warning', 'Please allow popups to print poster.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Roll Call QR Poster</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              text-align: center;
              padding: 40px;
              color: #111;
            }
            .card {
              border: 3px solid #111;
              border-radius: 24px;
              padding: 40px;
              max-width: 500px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            h1 { font-size: 28px; margin: 0 0 10px; font-weight: 900; }
            p { font-size: 14px; color: #555; margin: 0 0 24px; }
            img { width: 300px; height: 300px; border-radius: 12px; margin-bottom: 20px; }
            .code-box {
              background: #f0f0f0;
              padding: 12px;
              border-radius: 10px;
              font-family: monospace;
              font-size: 18px;
              font-weight: bold;
              margin-top: 15px;
            }
            .footer {
              margin-top: 25px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #777;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${title}</h1>
            <p>${subtitle || 'Scan with your smartphone camera to sign attendance'}</p>
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Roll Call QR Code" />` : ''}
            <div class="code-box">Short Code: ${shortCode || 'SCAN'}</div>
            <div class="footer">IWasHere • Anti-Proxy Geofence Verified</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      id="share-qr-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#0e141f] border border-[#212d40] rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Accent glow */}
        <div
          className="absolute -top-20 -right-20 w-44 h-44 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1d2738]">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0a0c10]"
              style={{ backgroundColor: accentColor }}
            >
              <Share2 className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Share QR Code</h3>
              <p className="text-[11px] text-slate-400">Direct Roll Call Access</p>
            </div>
          </div>

          <button
            id="btn-close-share-qr-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#141b26] hover:bg-[#1f2838] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-5">
          {/* QR Canvas Preview */}
          {qrDataUrl && (
            <div className="flex flex-col items-center justify-center">
              <div
                className="p-3.5 rounded-2xl border shadow-lg bg-[#0a0d13]"
                style={{ borderColor: `${accentColor}40` }}
              >
                <img
                  src={qrDataUrl}
                  alt="Roll Call QR Code"
                  className="w-44 h-44 sm:w-48 sm:h-48 rounded-xl shadow-md"
                />
              </div>
              <div className="mt-2.5 text-center">
                <span className="text-xs font-bold text-white block">{title}</span>
                {shortCode && (
                  <span
                    className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mt-1 border"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      color: accentColor,
                      borderColor: `${accentColor}30`,
                    }}
                  >
                    CODE: {shortCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Copy Link Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Attendance URL
            </label>
            <div className="flex items-center bg-[#090c12] border border-[#212d40] rounded-xl p-1.5 pl-3">
              <span className="text-xs font-mono text-slate-300 truncate flex-1">{shareUrl}</span>
              <button
                id="btn-modal-copy-link"
                type="button"
                onClick={handleCopy}
                className="py-1.5 px-3 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all text-[#0a0c10] shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-black" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share Channels */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              id="btn-share-whatsapp"
              type="button"
              onClick={handleWhatsAppShare}
              className="py-2.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              id="btn-share-telegram"
              type="button"
              onClick={handleTelegramShare}
              className="py-2.5 px-3 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/40 text-[#229ED9] text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Telegram</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                id="btn-share-native"
                type="button"
                onClick={handleNativeShare}
                className="col-span-2 py-2.5 px-3 rounded-xl bg-[#141b27] hover:bg-[#1d2738] border border-[#27344a] text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Smartphone className="w-4 h-4" style={{ color: accentColor }} />
                <span>Share via Device Apps</span>
              </button>
            )}
          </div>

          {/* Download & Print Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1d2738]">
            <button
              id="btn-modal-download-qr"
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download PNG</span>
            </button>

            <button
              id="btn-modal-print-poster"
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print A4 Poster</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
