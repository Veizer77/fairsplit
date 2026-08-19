import React from 'react';
import { Receipt, History, Settings, Sparkles, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  onOpenHistory,
  onOpenSettings,
  onOpenLatency,
  onReset,
  latestLatency
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('host')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-emerald-500 to-teal-400 p-[1.5px] shadow-glow">
            <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-brand-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-300 bg-clip-text text-transparent">
                FairSplit
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                PROPORTIONAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Split Bill Resto Adil, Cepat & Akurat</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {latestLatency && (
            <button
              onClick={onOpenLatency}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono text-slate-300 hover:border-brand-500/50 transition-colors"
              title="Lihat Telemetri Latensi Pipeline"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{latestLatency.totalMs || latestLatency.latencyMs || 0}ms</span>
            </button>
          )}

          <button
            onClick={onOpenHistory}
            className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Riwayat Struk Tersimpan"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Pengaturan Rekening & API"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition"
            title="Buat Struk Baru"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Struk Baru</span>
          </button>
        </div>
      </div>
    </header>
  );
}
