import React, { useState, useEffect } from 'react';
import { X, Calendar, Trash2, ArrowRight } from 'lucide-react';
import { db } from '../services/dbService';

export default function HistoryModal({ isOpen, onClose, onSelectReceipt }) {
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setReceipts(db.getAllReceipts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id, e) => {
    e.stopPropagation();
    db.deleteReceipt(id);
    setReceipts(db.getAllReceipts());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-4 shadow-glass max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base text-white">Riwayat Struk Tersimpan</h3>
            <p className="text-[11px] text-slate-400">Database lokal di perangkat Anda ({receipts.length} Struk)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {receipts.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">Belum ada riwayat struk tersimpan.</div>
          ) : (
            receipts.map(r => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/40 transition flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs text-white">{r.restaurant_name || 'Restoran'}</h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(r.updated_at || Date.now()).toLocaleDateString('id-ID')}</span>
                    <span>•</span>
                    <span className="font-mono text-brand-400 font-bold">Rp {r.grand_total?.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      onSelectReceipt(r);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 text-xs font-semibold transition"
                  >
                    Buka
                  </button>

                  <button
                    onClick={(e) => handleDelete(r.id, e)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                    title="Hapus riwayat struk"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
