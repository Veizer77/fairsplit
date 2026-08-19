import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, QrCode, MessageCircle, ArrowLeft, ShieldCheck, Sparkles, DollarSign, CheckCircle2, ExternalLink, Send, Maximize2, X, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { formatWhatsAppMessage, createEphemeralSession } from '../services/sessionService';
import { copyToClipboard } from '../utils/clipboard';

export default function ProportionalBreakdown({
  calculation,
  receipt,
  participants,
  allocations,
  onBack,
  hostSettings = {}
}) {
  const [copiedWA, setCopiedWA] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [paidStatus, setPaidStatus] = useState(() => {
    const initial = {};
    participants.forEach(p => initial[p.id] = !!p.is_paid);
    return initial;
  });

  const {
    restaurantName = 'Restoran',
    grandTotal = 0,
    tax = 0,
    serviceCharge = 0,
    discount = 0,
    breakdowns = [],
    rawDeviation,
    finalDeviation,
    isBalanced,
    highestSpender
  } = calculation;

  // Auto generate share link and QR session on mount
  useEffect(() => {
    handleGenerateShareLink(false);
  }, []);

  const togglePaid = (participantId) => {
    const nextVal = !paidStatus[participantId];
    setPaidStatus(prev => ({ ...prev, [participantId]: nextVal }));

    if (nextVal) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

  const getFormattedMessage = () => {
    return formatWhatsAppMessage({
      calculation: {
        ...calculation,
        breakdowns: breakdowns.map(b => ({ ...b, isPaid: paidStatus[b.participantId] }))
      },
      hostBank: hostSettings.bankName || 'BCA',
      accountNumber: hostSettings.accountNumber || '1234567890',
      accountHolder: hostSettings.accountHolder || 'Host',
      paymentMethods: hostSettings.paymentMethods || [],
      claimUrl: shareLink
    });
  };

  const handleCopyWhatsApp = async () => {
    const msg = getFormattedMessage();
    const success = await copyToClipboard(msg);
    if (success) {
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
    }
  };

  const handleSendWhatsApp = () => {
    const msg = getFormattedMessage();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleGenerateShareLink = async (triggerCopy = true) => {
    setIsGeneratingLink(true);
    try {
      const sessionData = {
        restaurantName,
        receipt,
        participants,
        allocations,
        calculation: {
          ...calculation,
          breakdowns
        },
        hostBank: hostSettings.bankName || 'BCA',
        accountNumber: hostSettings.accountNumber || '1234567890',
        accountHolder: hostSettings.accountHolder || 'Host',
        qrisImageUrl: hostSettings.qrisImageUrl || '',
        paymentMethods: hostSettings.paymentMethods || []
      };

      const res = await createEphemeralSession(sessionData);
      const url = `${window.location.origin}/b/${res.id}`;
      setShareLink(url);
      if (triggerCopy) {
        await copyToClipboard(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch (e) {
      console.error('Failed to generate ephemeral session:', e);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner: Mathematical Integrity & Grand Total */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative overflow-hidden shadow-glass">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Hasil Pembagian Proporsional</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                Deviasi Rp 0 (100% Pas)
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">{restaurantName}</h2>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400">Total Tagihan Struk:</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-brand-400">
              Rp {grandTotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Penny Drift / Deviasi Report Chip */}
        {highestSpender && rawDeviation !== 0 && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Penyesuaian selisih pembulatan ({rawDeviation > 0 ? '+' : ''}Rp {rawDeviation}) dialokasikan ke porsi terbesar (<strong>{highestSpender}</strong>).
              </span>
            </div>
            <span className="text-[11px] font-mono text-brand-400 font-bold shrink-0">Deviasi Akhir: Rp 0</span>
          </div>
        )}
      </div>

      {/* Table QR Code Card & WhatsApp Share Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Table QR Code Card */}
        <div className="glass-panel p-5 rounded-2xl border border-brand-500/40 bg-brand-500/5 space-y-4 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-brand-400" />
                <h3 className="font-bold text-sm text-white">Kode QR Meja Untuk Teman</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/30">
                Scan Kamera HP
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Minta teman scan Kode QR ini dari meja. Mereka akan memilih namanya masing-masing dan langsung melihat total tagihannya.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center my-4">
              <div
                onClick={() => setShowQrModal(true)}
                className="p-3.5 bg-white rounded-2xl shadow-xl cursor-pointer hover:scale-105 transition transform border-4 border-slate-800 group"
                title="Klik untuk perbesar QR Code"
              >
                {shareLink ? (
                  <QRCodeSVG
                    value={shareLink}
                    size={150}
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-slate-400 text-xs font-mono">
                    Membuat QR...
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="mt-2 text-[11px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Perbesar Layar Penuh</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => window.open(shareLink, '_blank')}
              disabled={!shareLink}
              className="py-2.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-glow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Link Tamu</span>
            </button>

            <button
              onClick={() => handleGenerateShareLink(true)}
              disabled={isGeneratingLink}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Tautan'}</span>
            </button>
          </div>
        </div>

        {/* WhatsApp Actions Card */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-4 shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Format Pesan WhatsApp</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Grup Chat
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Kirim rekap rincian tagihan per individu dan nomor rekening transfer langsung ke grup obrolan WhatsApp.
            </p>

            {/* Message Preview Box */}
            <div className="mt-3 p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {getFormattedMessage()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleSendWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-glow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim ke WA</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
            >
              {copiedWA ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedWA ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Individual Participant Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">
          Rincian Pembayaran per Individu ({breakdowns.length} Orang)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {breakdowns.map((b) => {
            const isPaid = paidStatus[b.participantId];

            return (
              <div
                key={b.participantId}
                className={`glass-panel rounded-2xl p-5 border transition flex flex-col justify-between ${
                  isPaid ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{b.name}</h4>
                        <span className="text-[11px] text-slate-400">Porsi: {(b.ratio * 100).toFixed(1)}% subtotal</span>
                      </div>
                    </div>

                    <button
                      onClick={() => togglePaid(b.participantId)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                        isPaid
                          ? 'bg-emerald-500 text-slate-950 shadow-glow'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      <span>{isPaid ? 'Lunas' : 'Belum Bayar'}</span>
                    </button>
                  </div>

                  {/* Items Eaten */}
                  <div className="py-3 space-y-1.5 text-xs text-slate-300">
                    {(b.items || []).map((item, iIdx) => (
                      <div key={iIdx} className="flex justify-between items-center">
                        <span className="line-clamp-1">
                          {item.name} {item.splitRatio < 0.99 ? `(${(item.splitRatio * 100).toFixed(0)}%)` : ''}
                        </span>
                        <span className="font-mono text-slate-400 shrink-0 ml-2">
                          Rp {Math.round(item.portionPrice || item.totalItemPrice || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}

                    {/* Proportional components */}
                    <div className="pt-2 border-t border-slate-800/60 space-y-1 text-[11px] text-slate-400 font-mono">
                      {b.roundedTax > 0 && (
                        <div className="flex justify-between">
                          <span>+ Pajak PB1/PPN:</span>
                          <span>Rp {b.roundedTax.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {b.roundedService > 0 && (
                        <div className="flex justify-between">
                          <span>+ Service Charge:</span>
                          <span>Rp {b.roundedService.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {b.roundedDiscount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>- Diskon/Promo:</span>
                          <span>-Rp {b.roundedDiscount.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {b.roundingAdjustment !== 0 && b.roundingAdjustment !== undefined && (
                        <div className="flex justify-between text-amber-400 font-medium">
                          <span>Penyesuaian Selisih:</span>
                          <span>{b.roundingAdjustment > 0 ? '+' : ''}Rp {b.roundingAdjustment.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Total */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Total Bayar:</span>
                  <span className="text-base font-black font-mono text-brand-400">
                    Rp {(b.finalTotal || b.initialRoundedTotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Multi-Payment Details Card */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Metode Pembayaran Tujuan Transfer ({(hostSettings.paymentMethods || []).length || 1})
          </h4>
          <span className="text-[11px] text-brand-400">Tersedia untuk Tamu</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(hostSettings.paymentMethods && hostSettings.paymentMethods.length > 0
            ? hostSettings.paymentMethods
            : [
                {
                  id: 'pm_fallback',
                  type: 'BANK',
                  provider: hostSettings.bankName || 'BCA',
                  accountNumber: hostSettings.accountNumber || '1234567890',
                  accountHolder: hostSettings.accountHolder || 'Nama Pemilik',
                  isPrimary: true
                }
              ]
          ).map((pm) => (
            <div key={pm.id} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-base">{pm.type === 'BANK' ? '🏦' : pm.type === 'EWALLET' ? '📱' : '🖼️'}</span>
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{pm.provider}</span>
                    {pm.isPrimary && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-brand-500/20 text-brand-400 font-semibold">Utama</span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                    {pm.type === 'QRIS' ? 'QRIS Gambar' : `${pm.accountNumber} (a.n. ${pm.accountHolder})`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-semibold text-xs transition"
        >
          Kembali ke Pilih Menu
        </button>
      </div>

      {/* Fullscreen QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="glass-panel w-full max-w-sm rounded-3xl border border-brand-500/40 p-6 space-y-5 text-center shadow-glass relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[11px] uppercase font-bold text-brand-400 tracking-wider">Pindai dari Meja</span>
              <h3 className="font-bold text-lg text-white mt-0.5">{restaurantName}</h3>
              <p className="text-xs text-slate-400 mt-1">Arahkan kamera HP ke Kode QR di bawah</p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl mx-auto border-4 border-slate-800">
              <QRCodeSVG
                value={shareLink || window.location.href}
                size={230}
                level="H"
                includeMargin={false}
              />
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs"
            >
              Tutup Layar QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
