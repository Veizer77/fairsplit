import React, { useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';

export default function ManualReceiptModal({ isOpen, onClose, onSave }) {
  const [restaurantName, setRestaurantName] = useState('Restoran');
  const [items, setItems] = useState([
    { id: 'm_1', name: 'Makanan 1', qty: 1, price_per_unit: 30000, total_price: 30000 },
    { id: 'm_2', name: 'Minuman 1', qty: 1, price_per_unit: 10000, total_price: 10000 }
  ]);
  const [tax, setTax] = useState(4000);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [discount, setDiscount] = useState(0);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: `m_${Date.now()}`, name: 'Item Baru', qty: 1, price_per_unit: 10000, total_price: 10000 }
    ]);
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...items];
    const item = { ...updated[idx] };
    if (field === 'name') item.name = val;
    if (field === 'qty') {
      const q = Math.max(1, parseInt(val, 10) || 1);
      item.qty = q;
      item.total_price = item.price_per_unit * q;
    }
    if (field === 'price_per_unit') {
      const p = Math.max(0, parseInt(val, 10) || 0);
      item.price_per_unit = p;
      item.total_price = p * item.qty;
    }
    updated[idx] = item;
    setItems(updated);
  };

  const subtotal = items.reduce((s, i) => s + i.total_price, 0);
  const grandTotal = subtotal + tax + serviceCharge - discount;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      restaurant_name: restaurantName,
      items,
      subtotal,
      tax,
      service_charge: serviceCharge,
      discount,
      grand_total: grandTotal
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 p-6 space-y-4 shadow-glass max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-base text-white">Input Manual Struk</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold">Nama Restoran</label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
              required
            />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Daftar Item</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-brand-400 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                  placeholder="Nama"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  required
                />
                <input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                  className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-white"
                />
                <input
                  type="number"
                  value={item.price_per_unit}
                  onChange={(e) => handleItemChange(idx, 'price_per_unit', e.target.value)}
                  className="w-24 text-right bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Extras */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
            <div>
              <label className="text-slate-400">Pajak</label>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(parseInt(e.target.value, 10) || 0)}
                className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-white font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-slate-400">Service</label>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(parseInt(e.target.value, 10) || 0)}
                className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-white font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-slate-400">Diskon</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseInt(e.target.value, 10) || 0)}
                className="w-full text-right bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-emerald-400 font-mono mt-1"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 font-bold text-sm text-white">
            <span>Grand Total:</span>
            <span className="font-mono text-brand-400">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold transition shadow-glow"
          >
            Simpan Struk
          </button>
        </form>
      </div>
    </div>
  );
}
