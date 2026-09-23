import { useState, useRef } from 'react';
import { UploadCloud, FileCheck, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw, X, Download, FileCode, Clock } from 'lucide-react';
import { Campaign, Attendee, Organization } from '../../types/attendance';
import { decryptOfflineRecord } from '../../utils/crypto';
import { importOfflineIwhRecord } from '../../services/firebase';
import { downloadStandaloneHtml } from '../../utils/standaloneHtmlGenerator';
import { useToast } from '../common/Toast';

interface OfflineDataImporterProps {
  campaign: Campaign;
  organization?: Organization | null;
  accentColor?: string;
  onRecordsImported: () => void;
}

interface ImportItemStatus {
  filename: string;
  stateCode?: string;
  name?: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  distanceMeters?: number;
  isTampered?: boolean;
  isLate?: boolean;
  timeBlockCode?: string;
}

export function OfflineDataImporter({
  campaign,
  organization,
  accentColor = '#00FF66',
  onRecordsImported,
}: OfflineDataImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<ImportItemStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleDownloadStandalone = () => {
    try {
      const filename = downloadStandaloneHtml(campaign, {
        organizationName: organization?.name,
        accentColor,
      });
      showToast('success', `Saved standalone zero-network file: ${filename}`);
    } catch {
      showToast('error', 'Failed to generate standalone HTML file.');
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const results: ImportItemStatus[] = [];
    let successCount = 0;
    let tamperedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.iwh')) {
        results.push({
          filename: file.name,
          status: 'error',
          message: 'Ignored: Only encrypted .iwh files are supported.',
        });
        continue;
      }

      try {
        const fileContent = await file.text();
        // 1. Decrypt and verify AES-GCM payload
        const record = await decryptOfflineRecord(fileContent);

        // 2. Validate and import into Firestore
        const outcome = await importOfflineIwhRecord(record, campaign);

        if (outcome.isTampered) {
          tamperedCount++;
        }

        results.push({
          filename: file.name,
          stateCode: record.stateCode,
          name: record.name,
          status: 'success',
          message: outcome.message,
          distanceMeters: outcome.distanceMeters,
          isTampered: outcome.isTampered,
          isLate: outcome.isLate,
          timeBlockCode: record.timeBlockCode,
        });
        successCount++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Decryption or verification failed.';
        results.push({
          filename: file.name,
          status: 'error',
          message: errMsg,
        });
      }
    }

    setImportResults((prev) => [...results, ...prev]);
    setIsProcessing(false);

    if (tamperedCount > 0) {
      showToast('error', `⚠️ Flagged ${tamperedCount} record(s) with OS clock tampering!`);
    }

    if (successCount > 0) {
      showToast('success', `Imported ${successCount} verified offline attendance record(s).`);
      onRecordsImported();
    } else if (results.some((r) => r.status === 'error')) {
      showToast('error', 'One or more .iwh files failed cryptographic verification.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const clearResults = () => {
    setImportResults([]);
  };

  return (
    <div
      id="offline-data-importer"
      className="bg-[#0e141f] border border-[#1e273a] rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00FF66]" />
              <span>Offline Data Importer (.iwh Files)</span>
            </h3>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              AES-GCM 256
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Import tamper-proof attendance packages created outdoors under zero network connectivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadStandalone}
            className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#151c28] hover:bg-[#1e2838] text-slate-200 border border-[#28374d] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Download standalone single-file HTML app for offline field deployment"
          >
            <FileCode className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Field HTML Generator</span>
          </button>

          {importResults.length > 0 && (
            <button
              onClick={clearResults}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          )}
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#00FF66] bg-[#00FF66]/5 scale-[1.01]'
            : 'border-[#243144] hover:border-slate-500 bg-[#0a0d13]/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".iwh"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-[#0a0c10] shadow-md transition-transform"
            style={{ backgroundColor: accentColor }}
          >
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-black" />
            ) : (
              <UploadCloud className="w-6 h-6 text-black" />
            )}
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-white">
              {isDragging ? 'Drop .iwh files here' : 'Click to browse or drag & drop .iwh files'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Receives tamper-proof files like <code className="text-emerald-400 font-mono">LA_23B_1234-2026-09-22.iwh</code>
            </p>
          </div>
          <span className="text-[10px] font-semibold text-slate-500 bg-[#141b27] px-2.5 py-1 rounded-full border border-[#232f42]">
            Target Session: {campaign.name}
          </span>
        </div>
      </div>

      {/* Import Processing Audit Feed */}
      {importResults.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-[#1a2333]">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Import Audit Feed ({importResults.length})
          </h4>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {importResults.map((item, idx) => {
              const isTampered = item.isTampered;
              const isLate = item.isLate;

              let cardBg = 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200';
              if (item.status === 'error' || isTampered) {
                cardBg = 'bg-rose-950/40 border-rose-500/60 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.15)]';
              } else if (isLate) {
                cardBg = 'bg-amber-950/30 border-amber-500/40 text-amber-100';
              }

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isTampered ? (
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                    ) : item.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-white text-sm">
                          {item.stateCode || item.filename}
                        </span>
                        {item.name && (
                          <span className="text-slate-300 font-medium text-xs">
                            • {item.name}
                          </span>
                        )}
                        {isTampered && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">
                            ⚠️ CLOCK MANIPULATED
                          </span>
                        )}
                        {isLate && !isTampered && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black">
                            ⏱️ LATE OVERRIDE
                          </span>
                        )}
                        {item.timeBlockCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-slate-700 text-slate-300">
                            Block: {item.timeBlockCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-85 mt-0.5">{item.message}</p>
                    </div>
                  </div>

                  {item.distanceMeters !== undefined && (
                    <span className="shrink-0 self-start sm:self-center text-[10px] font-mono px-2.5 py-1 rounded-lg bg-black/50 border border-slate-700 text-slate-200">
                      {item.distanceMeters}m from GPS center
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
