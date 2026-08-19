import React from 'react';
import { X, Zap, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function LatencyDashboard({ isOpen, onClose, telemetry }) {
  if (!isOpen) return null;

  const ocrLatency = telemetry?.ocrLatencyMs || 0;
  const llmLatency = telemetry?.llmLatencyMs || 0;
  const totalLatency = telemetry?.totalMs || (ocrLatency + llmLatency);

  const ocrPass = ocrLatency <= 800;
  const llmPass = llmLatency <= 1800;
  const totalPass = totalLatency <= 3000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-glass">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Telemetri Latensi & Performa SLA
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Total SLA */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-200">Pipeline Latency (E2E)</div>
              <div className="text-[11px] text-slate-500">Target SLA: &lt; 3.0 detik</div>
            </div>
            <div className="text-right">
              <span className={`text-base font-black font-mono ${totalPass ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalLatency} ms
              </span>
              <div className="text-[10px] text-slate-400">{totalPass ? '✅ Memenuhi SLA' : '⚠️ Melewati SLA'}</div>
            </div>
          </div>

          {/* OCR Latency */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-300">OCR Extraction</div>
              <div className="text-[10px] text-slate-500">On-Device Target: &le; 800ms</div>
            </div>
            <span className="font-mono font-bold text-slate-200">{ocrLatency} ms</span>
          </div>

          {/* LLM Latency */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-300">Groq LLM Structured Parsing</div>
              <div className="text-[10px] text-slate-500">Free Tier Target: &le; 1800ms</div>
            </div>
            <span className="font-mono font-bold text-slate-200">{llmLatency} ms</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
