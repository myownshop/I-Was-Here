import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check, ExternalLink, QrCode as QrIcon, Share2 } from 'lucide-react';
import { Campaign } from '../../types/attendance';
import { showToast } from '../common/Toast';
import { ShareQRModal } from '../common/ShareQRModal';

interface CampaignQRCardProps {
  campaign: Campaign;
  onOpenSession: () => void;
  accentColor?: string;
}

export function CampaignQRCard({
  campaign,
  onOpenSession,
  accentColor = '#00FF66',
}: CampaignQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const attendanceUrl = `${baseUrl}/#/c/${campaign.shortCode}`;

  useEffect(() => {
    async function generateQR() {
      try {
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, attendanceUrl, {
            width: 240,
            margin: 2,
            color: {
              dark: '#0a0c10',
              light: accentColor || '#00FF66',
            },
          });
          const url = canvasRef.current.toDataURL('image/png');
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error('QR code generation error:', err);
      }
    }

    generateQR();
  }, [attendanceUrl, accentColor]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(attendanceUrl);
    setCopied(true);
    showToast('info', `Copied short link: ${attendanceUrl}`, 'Link Copied');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `RollCall_QR_${campaign.shortCode.toUpperCase()}_${campaign.date}.png`;
    a.click();
    showToast('success', 'QR code saved to downloads.', 'Downloaded');
  };

  return (
    <>
      <div
        id={`campaign-qr-card-${campaign.id}`}
        className="bg-[#0f141f] rounded-2xl border border-[#212c3e] p-5 shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Left: High-Contrast QR Code Visual */}
          <div
            className="relative flex flex-col items-center p-3 rounded-2xl border shadow-lg"
            style={{
              backgroundColor: `${accentColor}12`,
              borderColor: `${accentColor}40`,
            }}
          >
            <canvas ref={canvasRef} className="rounded-xl shadow-md w-48 h-48 sm:w-52 sm:h-52" />
            <div className="mt-2 text-center">
              <span
                className="text-[10px] font-mono font-bold tracking-wider uppercase"
                style={{ color: accentColor }}
              >
                SCAN WITH SMARTPHONE
              </span>
            </div>
          </div>

          {/* Right: Manual Short Link Fallback & Details */}
          <div className="flex-1 w-full text-center lg:text-left">
            <div
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-bold mb-2"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              <QrIcon className="w-3.5 h-3.5" />
              <span>SESSION SHORT CODE</span>
            </div>

            <h3 className="text-lg font-black text-white truncate">{campaign.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">
              CDS Date: <span className="text-slate-200 font-medium">{campaign.date}</span> • Allowed Radius:{' '}
              <span className="font-medium" style={{ color: accentColor }}>
                {campaign.allowedRadius}m
              </span>
            </p>

            {/* Prominent Short Code Display */}
            <div className="bg-[#0a0d13] rounded-xl p-3 border border-[#1b2332] mb-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                Manual Fallback Link (In case of camera/poor light):
              </span>
              <div className="flex items-center justify-between bg-[#131924] rounded-lg px-3 py-2 border border-[#232f42]">
                <div
                  className="font-mono text-sm sm:text-base font-extrabold tracking-wider truncate"
                  style={{ color: accentColor }}
                >
                  {attendanceUrl}
                </div>
                <button
                  id={`btn-copy-shortlink-${campaign.id}`}
                  type="button"
                  onClick={handleCopyLink}
                  className="ml-2 p-1.5 rounded-md hover:bg-[#1f2838] text-slate-300 hover:text-white transition-colors shrink-0"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4" style={{ color: accentColor }} />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  Code: <strong className="text-white uppercase">{campaign.shortCode}</strong>
                </span>
                <span style={{ color: accentColor }}>Instant Resolution</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
              {/* Share QR Code Button */}
              <button
                id={`btn-share-qr-${campaign.id}`}
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="py-2 px-3.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer text-[#0a0c10]"
                style={{
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                }}
              >
                <Share2 className="w-3.5 h-3.5 text-black" />
                <span>Share QR Code</span>
              </button>

              <button
                id={`btn-download-qr-${campaign.id}`}
                type="button"
                onClick={handleDownloadQR}
                className="py-2 px-3.5 rounded-xl bg-[#18202d] hover:bg-[#202b3c] text-white border border-[#29354b] text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span>Download PNG</span>
              </button>

              <button
                id={`btn-open-session-${campaign.id}`}
                type="button"
                onClick={onOpenSession}
                className="py-2 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1b2434] text-white border border-[#29354b] text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Scanner</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ShareQRModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={campaign.name}
        subtitle={`Roll Call on ${campaign.date} • Radius: ${campaign.allowedRadius}m`}
        shareUrl={attendanceUrl}
        shortCode={campaign.shortCode}
        qrDataUrl={qrDataUrl}
        accentColor={accentColor}
      />
    </>
  );
}
