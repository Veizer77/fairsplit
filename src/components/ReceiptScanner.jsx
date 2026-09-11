import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertTriangle, FileText, ArrowRight, Zap, CheckCircle2, RefreshCw, Cpu, BrainCircuit, X, Settings } from 'lucide-react';
import { parseReceiptWithGemini } from '../services/geminiVisionService';

export default function ReceiptScanner({ onParsed, onManualEntry, onError, geminiApiKey, apiBase = '', onOpenSettings }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [scanError, setScanError] = useState(null);
  const fileInputRef = useRef(null);

  // Direct Image Processing via Gemini Multimodal Vision AI ONLY (No offline fallback)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setIsProcessing(true);
    setStatusMessage('Menganalisis struk dengan Gemini Multimodal Vision AI...');
    const pipeStart = performance.now();

    try {
      const visionResult = await parseReceiptWithGemini(file, geminiApiKey, apiBase);
      const totalPipelineMs = Math.round(performance.now() - pipeStart);

      onParsed({
        receipt: visionResult.data,
        rawText: `[Vision AI Extracted: ${visionResult.model}]`,
        telemetry: {
          ocrLatencyMs: 0,
          llmLatencyMs: visionResult.latencyMs,
          totalMs: totalPipelineMs,
          source: visionResult.source,
          model: visionResult.model
        }
      });
    } catch (visionErr) {
      console.warn('Gemini Vision failed:', visionErr.message);
      const errorMsg = visionErr?.message || 'Gemini Vision AI tidak dapat digunakan saat ini.';
      setScanError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Notification Banner when Gemini cannot be used */}
      {scanError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-left space-y-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-rose-300">Gemini Vision AI Tidak Dapat Digunakan</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{scanError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScanError(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
              title="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20 text-xs">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-brand-400" />
                <span>Periksa API Key di Pengaturan</span>
              </button>
            )}
            <button
              type="button"
              onClick={onManualEntry}
              className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-glow"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Input Manual Saja</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs transition"
            >
              Coba Pilih Foto Lain
            </button>
          </div>
        </div>
      )}

      {/* Scanner Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden shadow-glass">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="text-center max-w-md mx-auto mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-4 shadow-glow">
            <Camera className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Pindai Struk Restoran</span>
          </h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold mt-2">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Didukung Gemini Multimodal Vision AI</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Membaca nama makanan, harga, pajak PB1, dan service charge secara instan dari foto kamera.
          </p>
        </div>

        {/* Dropzone / Upload Area */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          capture="environment"
          className="hidden"
        />

        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isProcessing
              ? 'border-brand-500/50 bg-brand-500/5'
              : 'border-slate-700/80 hover:border-brand-500/60 hover:bg-slate-800/40 bg-slate-900/40'
          }`}
        >
          {isProcessing ? (
            <div className="space-y-4 py-4">
              <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white">{statusMessage}</p>
                <p className="text-xs text-slate-400 mt-1">Mengirim gambar ke Gemini Multimodal Vision...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-300">
                <Upload className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Ambil Foto atau Unggah Foto Struk
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Format JPG, PNG, WEBP • Diproses Otomatis oleh Gemini Vision AI
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-slate-950 font-semibold text-xs transition shadow-glow inline-flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Buka Kamera / Pilih File
              </button>
            </div>
          )}
        </div>

        {/* Manual Entry Fallback Button */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Tidak punya foto struk atau API tidak tersedia?</span>
          <button
            type="button"
            onClick={onManualEntry}
            className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Ketik Manual Item & Pajak
          </button>
        </div>
      </div>
    </div>
  );
}
