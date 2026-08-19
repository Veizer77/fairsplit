import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Key, CreditCard, Plus, Trash2, Check, Star, Upload, Image, Sparkles } from 'lucide-react';
import { db, POPULAR_PROVIDERS } from '../services/dbService';

export default function SettingsModal({ isOpen, onClose, onSaveSettings }) {
  const [settings, setSettings] = useState(db.getSettings());
  const [activeTab, setActiveTab] = useState('PAYMENT'); // 'PAYMENT' | 'API_KEY'
  
  // New Payment Method Form State
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [newProvider, setNewProvider] = useState('BCA');
  const [newType, setNewType] = useState('BANK');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState(settings.hostName || 'Nama Pemilik');
  const [newQrisImage, setNewQrisImage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const current = db.getSettings();
      setSettings(current);
      setNewAccountHolder(current.hostName || 'Nama Pemilik');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const paymentMethods = settings.paymentMethods || [];

  const handleProviderSelect = (prov) => {
    setNewProvider(prov.name);
    setNewType(prov.type);
  };

  const handleQrisUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewQrisImage(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPaymentMethod = (e) => {
    e.preventDefault();
    if (newType === 'QRIS' && !newQrisImage) {
      alert('Silakan pilih/unggah foto QRIS terlebih dahulu.');
      return;
    }
    if (newType !== 'QRIS' && !newAccountNumber.trim()) {
      alert('Nomor rekening atau nomor HP wajib diisi.');
      return;
    }

    const newMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type: newType,
      provider: newProvider,
      accountNumber: newAccountNumber.trim(),
      accountHolder: newAccountHolder.trim() || settings.hostName || 'Nama Host',
      imageUrl: newQrisImage || '',
      isPrimary: paymentMethods.length === 0
    };

    const updatedMethods = [...paymentMethods, newMethod];
    const updated = {
      ...settings,
      paymentMethods: updatedMethods,
      // Sync primary fields for legacy compatibility
      bankName: updatedMethods.find(m => m.isPrimary)?.provider || updatedMethods[0]?.provider || 'BCA',
      accountNumber: updatedMethods.find(m => m.isPrimary)?.accountNumber || updatedMethods[0]?.accountNumber || '',
      accountHolder: updatedMethods.find(m => m.isPrimary)?.accountHolder || updatedMethods[0]?.accountHolder || ''
    };

    setSettings(updated);
    setIsAddingMethod(false);
    setNewAccountNumber('');
    setNewQrisImage('');
  };

  const handleDeleteMethod = (id) => {
    if (paymentMethods.length <= 1) {
      alert('Minimal harus ada 1 metode pembayaran aktif.');
      return;
    }
    const updatedMethods = paymentMethods.filter(m => m.id !== id);
    if (!updatedMethods.some(m => m.isPrimary)) {
      updatedMethods[0].isPrimary = true;
    }

    const updated = {
      ...settings,
      paymentMethods: updatedMethods,
      bankName: updatedMethods[0].provider,
      accountNumber: updatedMethods[0].accountNumber,
      accountHolder: updatedMethods[0].accountHolder
    };

    setSettings(updated);
  };

  const handleSetPrimary = (id) => {
    const updatedMethods = paymentMethods.map(m => ({
      ...m,
      isPrimary: m.id === id
    }));
    const primary = updatedMethods.find(m => m.id === id);

    const updated = {
      ...settings,
      paymentMethods: updatedMethods,
      bankName: primary?.provider || 'BCA',
      accountNumber: primary?.accountNumber || '',
      accountHolder: primary?.accountHolder || ''
    };

    setSettings(updated);
  };

  const handleSaveAll = (e) => {
    e?.preventDefault?.();
    db.saveSettings(settings);
    onSaveSettings(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-800 p-6 space-y-5 shadow-glass max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Pengaturan Host & Pembayaran</h3>
              <p className="text-[11px] text-slate-400">Kelola rekening & integrasi Vision AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('PAYMENT')}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'PAYMENT' ? 'bg-brand-500 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Metode Pembayaran ({paymentMethods.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('API_KEY')}
            className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'API_KEY' ? 'bg-brand-500 text-slate-950 shadow-glow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Google Gemini Key</span>
          </button>
        </div>

        {/* TAB 1: Payment Methods Management */}
        {activeTab === 'PAYMENT' && (
          <div className="space-y-4">
            {/* Host Name Field */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Nama Lengkap Host (Pemilik Acara)</label>
              <input
                type="text"
                value={settings.hostName || ''}
                onChange={(e) => setSettings({ ...settings, hostName: e.target.value })}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500"
                placeholder="Contoh: Budi Santoso"
              />
            </div>

            {/* List of Configured Payment Methods */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Daftar Rekening & E-Wallet Aktif:
                </span>
                {!isAddingMethod && (
                  <button
                    type="button"
                    onClick={() => setIsAddingMethod(true)}
                    className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Metode</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                      m.isPrimary
                        ? 'bg-brand-500/10 border-brand-500/80 shadow-glow'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">
                        {m.type === 'BANK' ? '🏦' : m.type === 'EWALLET' ? '📱' : '🖼️'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-white">{m.provider}</h4>
                          {m.isPrimary && (
                            <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 text-[10px] font-bold border border-brand-500/40">
                              Utama
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-300 mt-0.5">
                          {m.type === 'QRIS' ? 'Gambar QRIS Tersedia' : `${m.accountNumber} • a.n. ${m.accountHolder}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!m.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(m.id)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition"
                          title="Jadikan metode utama"
                        >
                          Set Utama
                        </button>
                      )}
                      {paymentMethods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMethod(m.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                          title="Hapus rekening"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Method Form Drawer */}
            {isAddingMethod && (
              <form onSubmit={handleAddPaymentMethod} className="p-4 rounded-2xl bg-slate-900 border border-brand-500/40 space-y-3 shadow-glass">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-brand-400">Tambah Metode Pembayaran Baru</h4>
                  <button type="button" onClick={() => setIsAddingMethod(false)} className="text-slate-400 hover:text-white text-xs">
                    Batal
                  </button>
                </div>

                {/* Popular Provider Selection Chips */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Pilih Provider Bank / E-Wallet:</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-28 overflow-y-auto pr-1">
                    {POPULAR_PROVIDERS.map((prov) => (
                      <button
                        key={prov.name}
                        type="button"
                        onClick={() => handleProviderSelect(prov)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition flex items-center gap-1 ${
                          newProvider === prov.name
                            ? 'bg-brand-500 text-slate-950 font-bold border-brand-500 shadow-glow'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <span>{prov.icon}</span>
                        <span>{prov.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Fields for Bank / E-Wallet */}
                {newType !== 'QRIS' ? (
                  <>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300">
                        {newType === 'BANK' ? 'Nomor Rekening Bank' : 'Nomor HP E-Wallet'}
                      </label>
                      <input
                        type="text"
                        value={newAccountNumber}
                        onChange={(e) => setNewAccountNumber(e.target.value)}
                        placeholder={newType === 'BANK' ? 'Contoh: 1234567890' : 'Contoh: 081234567890'}
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300">Atas Nama Pemilik Rekening</label>
                      <input
                        type="text"
                        value={newAccountHolder}
                        onChange={(e) => setNewAccountHolder(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        required
                      />
                    </div>
                  </>
                ) : (
                  /* Form Field for QRIS Upload */
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300">Upload Gambar QRIS Static (PNG/JPG)</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleQrisUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1.5 border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-4 text-center cursor-pointer bg-slate-950"
                    >
                      {newQrisImage ? (
                        <div className="space-y-2">
                          <img src={newQrisImage} alt="Preview QRIS" className="w-24 h-24 object-contain mx-auto rounded-lg" />
                          <span className="text-[10px] text-emerald-400 block font-semibold">✓ Foto QRIS Berhasil Diunggah (Klik untuk ganti)</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-5 h-5 text-brand-400 mx-auto" />
                          <span className="text-xs text-slate-300 block font-medium">Klik untuk Unggah Gambar QRIS</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition shadow-glow flex items-center justify-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Metode Pembayaran Ini</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: API Key Configuration */}
        {activeTab === 'API_KEY' && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Google Gemini API Key</span>
              </label>
              <input
                type="password"
                value={settings.geminiApiKey || ''}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono"
                placeholder="AQ.Ab8RN6Iy5Pcl73uvQMxy..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Kunci API digunakan oleh model <strong>Gemini 3.1 Flash Lite</strong> untuk membaca foto struk restoran Anda.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-bold transition shadow-glow flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Semua Pengaturan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
