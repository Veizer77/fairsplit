import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2, ArrowRight, Zap, RotateCcw, DollarSign, Eye, X, Filter, Sparkles } from 'lucide-react';

export default function ReceiptReview({ receipt, rawText, onUpdateReceipt, onConfirm, onBack, telemetry }) {
  const [restaurantName, setRestaurantName] = useState(receipt.restaurant_name || 'Restoran');
  const [items, setItems] = useState(receipt.items || []);
  const [tax, setTax] = useState(Number(receipt.tax) || 0);
  const [serviceCharge, setServiceCharge] = useState(Number(receipt.service_charge) || 0);
  const [discount, setDiscount] = useState(Number(receipt.discount) || 0);
  const [subtotal, setSubtotal] = useState(Number(receipt.subtotal) || 0);
  const [grandTotal, setGrandTotal] = useState(Number(receipt.grand_total) || 0);
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Recalculate sum of items
  const itemsSum = items.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0);
  const calculatedGrand = itemsSum + tax + serviceCharge - discount;
  const hasMismatch = Math.abs(itemsSum - subtotal) > 0.01;
  const mismatchDiff = itemsSum - subtotal;

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'name') {
      item.name = value;
    } else if (field === 'qty') {
      const q = Math.max(1, parseInt(value, 10) || 1);
      item.qty = q;
      item.total_price = item.price_per_unit * q;
    } else if (field === 'price_per_unit') {
      const p = Math.max(0, parseInt(value, 10) || 0);
      item.price_per_unit = p;
      item.total_price = p * item.qty;
    } else if (field === 'total_price') {
      const t = Math.max(0, parseInt(value, 10) || 0);
      item.total_price = t;
      item.price_per_unit = Math.round(t / item.qty);
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: 'Item Baru',
        qty: 1,
        price_per_unit: 10000,
        total_price: 10000
      }
    ]);
  };

  const handleDeleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Filter out any suspicious item names (e.g. metadata that slipped through)
  const handleCleanNonItems = () => {
    const suspiciousWords = /meja|table|pax|cashier|kasir|kembali|change|tunai|cash|debit|qris|bill|invoice|trx|telp|phone|wifi|terima kasih|thank/i;
    const cleaned = items.filter(i => !suspiciousWords.test(i.name) && i.total_price > 0 && i.total_price !== 2024 && i.total_price !== 2025 && i.total_price !== 2026);
    setItems(cleaned);
  };

  const handleAutoFixSubtotal = () => {
    setSubtotal(itemsSum);
    setGrandTotal(itemsSum + tax + serviceCharge - discount);
  };

  const handleProceed = () => {
    const payload = {
      restaurant_name: restaurantName,
      items,
      subtotal: subtotal > 0 ? subtotal : itemsSum,
      tax,
      service_charge: serviceCharge,
      discount,
      grand_total: grandTotal > 0 ? grandTotal : calculatedGrand
    };
    onUpdateReceipt(payload);
    onConfirm(payload);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-slate-800">
        <div>
          <label className="text-xs uppercase tracking-wider font-bold text-slate-400">Nama Restoran / Tempat</label>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="mt-1 bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-bold text-lg w-full sm:w-80 focus:border-brand-500 focus:outline-none"
            placeholder="Contoh: Bebek Bengil Ubud"
          />
        </div>

        <div className="flex items-center gap-2">
          {rawText && (
            <button
              onClick={() => setShowRawOcr(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
              title="Lihat Teks Mentah Hasil Scan OCR"
            >
              <Eye className="w-3.5 h-3.5 text-brand-400" />
              <span>Teks Asli OCR</span>
            </button>
          )}

          {telemetry && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{telemetry.source === 'GEMINI_VISION' || telemetry.source === 'GEMINI_VISION_PROXY' ? '✨ Gemini Vision' : telemetry.source === 'GROQ_LLM' ? '🤖 Groq AI' : '⚡ Vision Engine'}</span>
              <span>•</span>
              <span className="text-brand-400 font-bold">{telemetry.totalMs || telemetry.latencyMs || 0}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Mismatch Warning Alert */}
      {hasMismatch && (
        <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 glow-amber">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Selisih Subtotal Terdeteksi!</div>
              <div className="text-xs text-amber-300/80 mt-0.5">
                Total item (Rp {itemsSum.toLocaleString('id-ID')}) ≠ Subtotal struk (Rp {subtotal.toLocaleString('id-ID')}).
                Selisih: {mismatchDiff > 0 ? '+' : ''}Rp {mismatchDiff.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          <button
            onClick={handleAutoFixSubtotal}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition shrink-0"
          >
            Sinkronkan Otomatis (Rp {itemsSum.toLocaleString('id-ID')})
          </button>
        </div>
      )}

      {/* Items Table Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-glass">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div>
            <h3 className="font-bold text-base text-white">Daftar Item Menu ({items.length})</h3>
            <p className="text-xs text-slate-400">Verifikasi dan sesuaikan item sebelum pembagian ke teman.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanNonItems}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition"
              title="Bersihkan teks bukan makanan"
            >
              <Filter className="w-3 h-3 text-amber-400" />
              <span>Filter Noise</span>
            </button>
            <button
              onClick={handleAddItem}
              className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Item
            </button>
          </div>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Belum ada item terdeteksi. Tekan "Tambah Item" untuk memasukkan pesanan.
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={item.id || idx} className="p-3.5 sm:p-4 hover:bg-slate-800/30 transition flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>

                {/* Item Name */}
                <div className="flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    className="w-full bg-slate-900/70 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                    placeholder="Nama Item"
                  />
                </div>

                {/* Qty */}
                <div className="w-16">
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                    className="w-full text-center bg-slate-900/70 border border-slate-700/60 rounded-lg px-2 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none"
                    title="Kuantitas"
                  />
                </div>

                {/* Total Price */}
                <div className="w-28 sm:w-32">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-mono">Rp</span>
                    <input
                      type="number"
                      value={item.total_price}
                      onChange={(e) => handleItemChange(idx, 'total_price', e.target.value)}
                      className="w-full text-right bg-slate-900/70 border border-slate-700/60 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-mono text-white font-semibold focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteItem(idx)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Hapus Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Extra Charges Section (Tax, Service, Discount) */}
        <div className="p-4 sm:p-5 bg-slate-900/60 border-t border-slate-800 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tax */}
            <div>
              <label className="text-slate-400 font-medium">Pajak Resto (PB1 / PPN)</label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">Rp</span>
                <input
                  type="number"
                  value={tax}
                  onChange={(e) => setTax(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2.5 py-1.5 font-mono text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Service Charge */}
            <div>
              <label className="text-slate-400 font-medium">Biaya Layanan (Service Charge)</label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">Rp</span>
                <input
                  type="number"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2.5 py-1.5 font-mono text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Discount */}
            <div>
              <label className="text-slate-400 font-medium">Diskon / Potongan Promo</label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">Rp</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2.5 py-1.5 font-mono text-emerald-400 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Grand Total Summary */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-200">Grand Total Tagihan:</span>
            <span className="text-lg font-black font-mono text-brand-400">
              Rp {calculatedGrand.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* Action Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-semibold text-xs transition"
        >
          Kembali ke Scan
        </button>

        <button
          type="button"
          onClick={handleProceed}
          className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-sm transition shadow-glow flex items-center gap-2"
        >
          <span>Lanjut ke Bagi Pesanan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Raw OCR Text Modal */}
      {showRawOcr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-glass max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-brand-400" />
                  Inspeksi Teks Asli OCR
                </h3>
                <p className="text-xs text-slate-400">Teks mentah yang diekstrak oleh kamera / scanner.</p>
              </div>
              <button onClick={() => setShowRawOcr(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {rawText || 'Tidak ada teks OCR.'}
            </div>

            <button
              onClick={() => setShowRawOcr(false)}
              className="w-full py-2.5 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs"
            >
              Tutup Inspektur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
