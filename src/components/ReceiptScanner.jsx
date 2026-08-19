import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertTriangle, FileText, ArrowRight, Zap, CheckCircle2, RefreshCw, Cpu, BrainCircuit } from 'lucide-react';
import { runReceiptOcr } from '../services/ocrService';
import { parseReceiptWithGemini } from '../services/geminiVisionService';
import { parseReceiptWithRegex } from '../services/regexParserService';

export default function ReceiptScanner({ onParsed, onManualEntry, onError, geminiApiKey }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

  // Direct Image Processing via Gemini Multimodal Vision AI
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('Menganalisis struk dengan Gemini Multimodal Vision AI...');
    const pipeStart = performance.now();

    try {
      // 1. Primary Engine: Google Gemini Multimodal Vision AI
      const visionResult = await parseReceiptWithGemini(file, geminiApiKey);
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
      console.warn('Gemini Vision failed, attempting local OCR fallback:', visionErr.message);
      setStatusMessage('Vision AI offline, menjalankan fallback OCR lokal...');

      try {
        const ocrResult = await runReceiptOcr(file, (p) => setOcrProgress(p));
        const regexResult = parseReceiptWithRegex(ocrResult.rawText);
        const totalPipelineMs = Math.round(performance.now() - pipeStart);

        onParsed({
          receipt: regexResult.data,
          rawText: ocrResult.rawText,
          telemetry: {
            ocrLatencyMs: ocrResult.latencyMs,
            llmLatencyMs: 0,
            totalMs: totalPipelineMs,
            source: 'OFFLINE_FALLBACK',
            model: 'heuristic-engine'
          }
        });
      } catch (fallbackErr) {
        onError(`Gagal memproses struk: ${visionErr.message}`);
      }
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      setOcrProgress(0);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
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
            <div className="space-y-4 py-2">
              <RefreshCw className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white">{statusMessage}</p>
                {ocrProgress > 0 && (
                  <div className="w-48 mx-auto mt-3 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                    <div
                      className="bg-brand-500 h-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                )}
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
                  Format JPG, PNG, WEBP • Diproses Otomatis oleh Vision AI
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
          <span className="text-slate-400">Tidak punya foto struk saat ini?</span>
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
