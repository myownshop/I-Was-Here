import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check, ExternalLink, QrCode as QrIcon, Share2, Lock, RotateCcw, Edit3 } from 'lucide-react';
import { Campaign } from '../../types/attendance';
import { showToast } from '../common/Toast';
import { ShareQRModal } from '../common/ShareQRModal';
import { formatWATTime } from '../../utils/dateUtils';

interface CampaignQRCardProps {
  campaign: Campaign;
  onOpenSession: () => void;
  onEditSession?: () => void;
  onCloseSession?: () => void;
  onReopenSession?: () => void;
  isHistoryMode?: boolean;
  accentColor?: string;
}

export function CampaignQRCard({
  campaign,
  onOpenSession,
  onEditSession,
  onCloseSession,
  onReopenSession,
  isHistoryMode = false,
  accentColor = '#00FF66',
}: CampaignQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const isClosed = campaign.status === 'closed' || campaign.isClosed || isHistoryMode;
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
              light: isClosed ? '#94a3b8' : accentColor || '#00FF66',
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
  }, [attendanceUrl, accentColor, isClosed]);

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
        className={`rounded-2xl border p-5 shadow-lg relative overflow-hidden transition-all ${
          isClosed
            ? 'bg-[#0e121a] border-[#252f40]'
            : 'bg-[#0f141f] border-[#212c3e]'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Left: High-Contrast QR Code Visual */}
          <div
            className="relative flex flex-col items-center p-3 rounded-2xl border shadow-lg"
            style={{
              backgroundColor: isClosed ? '#1e293b50' : `${accentColor}12`,
              borderColor: isClosed ? '#475569' : `${accentColor}40`,
            }}
          >
            <canvas ref={canvasRef} className="rounded-xl shadow-md w-48 h-48 sm:w-52 sm:h-52" />
            <div className="mt-2 text-center">
              <span
                className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isClosed ? 'text-slate-400' : ''
                }`}
                style={!isClosed ? { color: accentColor } : {}}
              >
                {isClosed ? 'SESSION ENDED / ARCHIVED' : 'SCAN WITH SMARTPHONE'}
              </span>
            </div>
          </div>

          {/* Right: Manual Short Link Fallback & Details */}
          <div className="flex-1 w-full text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-2 flex-wrap">
              <div
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-bold"
                style={{
                  backgroundColor: isClosed ? '#33415550' : `${accentColor}15`,
                  borderColor: isClosed ? '#475569' : `${accentColor}35`,
                  color: isClosed ? '#94a3b8' : accentColor,
                }}
              >
                <QrIcon className="w-3.5 h-3.5" />
                <span>SESSION CODE</span>
              </div>

              {isClosed ? (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>CLOSED SESSION (IN HISTORY)</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 animate-pulse">
                  ● ACTIVE ROLL CALL
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-white truncate">{campaign.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">
              CDS Date: <span className="text-slate-200 font-medium">{campaign.date}</span> • Allowed Radius:{' '}
              <span className="font-medium" style={{ color: isClosed ? '#94a3b8' : accentColor }}>
                {campaign.allowedRadius}m
              </span>
              {campaign.closedAt && (
                <span className="ml-2 text-slate-400">
                  • Ended: {formatWATTime(campaign.closedAt, { includeTimezone: true })}
                </span>
              )}
            </p>

            {/* Prominent Short Code Display */}
            <div className="bg-[#0a0d13] rounded-xl p-3 border border-[#1b2332] mb-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                Manual Fallback Link:
              </span>
              <div className="flex items-center justify-between bg-[#131924] rounded-lg px-3 py-2 border border-[#232f42]">
                <div
                  className="font-mono text-sm sm:text-base font-extrabold tracking-wider truncate"
                  style={{ color: isClosed ? '#94a3b8' : accentColor }}
                >
                  {attendanceUrl}
                </div>
                <button
                  id={`btn-copy-shortlink-${campaign.id}`}
                  type="button"
                  onClick={handleCopyLink}
                  className="ml-2 p-1.5 rounded-md hover:bg-[#1f2838] text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[#00FF66]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  Code: <strong className="text-white uppercase">{campaign.shortCode}</strong>
                </span>
                <span style={{ color: isClosed ? '#94a3b8' : accentColor }}>
                  {isClosed ? 'Archived Record' : 'Instant Resolution'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
              {!isClosed ? (
                <>
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

                  {/* Edit Session Button */}
                  {onEditSession && (
                    <button
                      id={`btn-edit-session-${campaign.id}`}
                      type="button"
                      onClick={onEditSession}
                      className="py-2 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1c2637] text-slate-200 hover:text-white border border-[#29354b] text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
                      title="Edit venue, date, geofence radius, and time blocks"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit Session</span>
                    </button>
                  )}

                  {/* Close / End Session Button */}
                  {onCloseSession && (
                    <button
                      id={`btn-close-session-${campaign.id}`}
                      type="button"
                      onClick={onCloseSession}
                      className="py-2 px-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/60 text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
                      title="End this session and move to History"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      <span>End &amp; Close Session</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    id={`btn-download-qr-history-${campaign.id}`}
                    type="button"
                    onClick={handleDownloadQR}
                    className="py-2 px-3.5 rounded-xl bg-[#18202d] hover:bg-[#202b3c] text-white border border-[#29354b] text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-300" />
                    <span>Download QR</span>
                  </button>

                  {onEditSession && (
                    <button
                      id={`btn-edit-session-history-${campaign.id}`}
                      type="button"
                      onClick={onEditSession}
                      className="py-2 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1c2637] text-slate-200 hover:text-white border border-[#29354b] text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
                      title="Edit past session details"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit Details</span>
                    </button>
                  )}

                  {onReopenSession && (
                    <button
                      id={`btn-reopen-session-${campaign.id}`}
                      type="button"
                      onClick={onReopenSession}
                      className="py-2 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1b2434] text-white border border-[#29354b] text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#00FF66]" />
                      <span>Re-activate Session</span>
                    </button>
                  )}
                </>
              )}
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
