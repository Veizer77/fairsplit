import React, { useState, useEffect } from 'react';
import { Check, CheckCircle2, Copy, DollarSign, Receipt, Share2, Sparkles, User, Users, ArrowLeft, CreditCard, ShieldCheck, QrCode, ExternalLink, Image } from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchEphemeralSession } from '../services/sessionService';
import { calculateFairSplit } from '../services/proportionalEngine';
import { copyToClipboard } from '../utils/clipboard';

const AVATAR_COLORS = [
  'bg-emerald-500 text-slate-950',
  'bg-sky-500 text-slate-950',
  'bg-amber-500 text-slate-950',
  'bg-violet-500 text-white',
  'bg-rose-500 text-white',
  'bg-teal-500 text-slate-950',
  'bg-indigo-500 text-white'
];

export default function GuestClaimView({ sessionId, onBackToHost }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [copiedRekening, setCopiedRekening] = useState('');
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(0);
  const [isConfirmedPaid, setIsConfirmedPaid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await fetchEphemeralSession(sessionId);
      if (data) {
        setSession(data);
      } else {
        setError('Sesi split bill ini tidak ditemukan atau sudah kedaluwarsa (24 jam).');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRekening = async (accNum, id) => {
    const success = await copyToClipboard(accNum);
    if (success) {
      setCopiedRekening(id || accNum);
      setTimeout(() => setCopiedRekening(''), 2500);
    }
  };

  const handleConfirmPaid = () => {
    setIsConfirmedPaid(true);
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.7 }
    });
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl border-4 border-brand-500 border-t-transparent animate-spin mx-auto shadow-glow" />
        <p className="text-sm font-semibold text-white">Memuat rincian tagihan dari meja...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="max-w-md mx-auto p-6 glass-panel rounded-3xl text-center space-y-4 border border-rose-500/30 shadow-glass my-12">
        <h3 className="text-lg font-bold text-rose-400">Sesi Tidak Ditemukan</h3>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={onBackToHost}
          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const restaurantName = session?.restaurantName || session?.receipt?.restaurant_name || 'Restoran';
  const participants = session?.participants || [];
  
  // Exclude Host from guest selector list
  const guestParticipants = participants.filter(p => !/host|saya/i.test(p.name));
  const availableGuests = guestParticipants.length > 0 ? guestParticipants : participants;

  // Calculate or retrieve full breakdown calculation
  let calculation = session?.calculation;
  if (!calculation && session?.receipt) {
    calculation = calculateFairSplit({
      receipt: session.receipt,
      participants: session.participants,
      allocations: session.allocations || []
    });
  }

  const breakdowns = calculation?.breakdowns || [];
  const selectedBreakdown = breakdowns.find(b => b.participantId === selectedParticipantId);
  const selectedParticipant = participants.find(p => p.id === selectedParticipantId);

  // Available Payment Methods from Host
  const paymentMethods = session?.paymentMethods && session.paymentMethods.length > 0
    ? session.paymentMethods
    : [
        {
          id: 'pm_legacy',
          type: 'BANK',
          provider: session?.hostBank || 'BCA',
          accountNumber: session?.accountNumber || '1234567890',
          accountHolder: session?.accountHolder || 'Nama Host',
          imageUrl: session?.qrisImageUrl || '',
          isPrimary: true
        }
      ];

  const activePayment = paymentMethods[selectedPaymentIndex] || paymentMethods[0];

  return (
    <div className="w-full max-w-md mx-auto space-y-5 px-2 py-4">
      {/* Top Header Card */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 text-center space-y-1.5 shadow-glass relative overflow-hidden">
        <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 mb-1">
          <Receipt className="w-3.5 h-3.5" />
          <span>Split Bill Meja Restoran</span>
        </div>
        <h2 className="text-xl font-black text-white">{restaurantName}</h2>
        <p className="text-xs text-slate-400">
          Total Tagihan: <span className="font-mono font-bold text-brand-400">Rp {(session?.receipt?.grand_total || calculation?.grandTotal || 0).toLocaleString('id-ID')}</span>
        </p>
      </div>

      {/* SCREEN 1: Choose Your Name (Pilih Nama Kamu) */}
      {!selectedParticipantId && (
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-glass">
          <div className="text-center space-y-1 pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-white">Siapakah Namamu?</h3>
            <p className="text-xs text-slate-400">Pilih namamu di bawah untuk melihat rincian tagihan:</p>
          </div>

          <div className="space-y-2.5">
            {availableGuests.map((guest, idx) => {
              const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const pBreakdown = breakdowns.find(b => b.participantId === guest.id);
              const totalAmount = pBreakdown ? (pBreakdown.finalTotal || pBreakdown.initialRoundedTotal || 0) : 0;

              return (
                <div
                  key={guest.id}
                  onClick={() => setSelectedParticipantId(guest.id)}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-brand-500 hover:bg-slate-800/80 cursor-pointer transition flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition transform`}>
                      {guest.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white group-hover:text-brand-300 transition">
                        {guest.name}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {pBreakdown?.items?.length || 0} menu makanan
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Total Tagihan:</span>
                    <span className="text-sm font-black font-mono text-brand-400">
                      Rp {totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SCREEN 2: Personal Bill Breakdown & Host Multi-Payment Options */}
      {selectedParticipantId && selectedBreakdown && (
        <div className="space-y-4">
          {/* Guest Personal Breakdown Card */}
          <div className="glass-panel p-5 rounded-3xl border border-brand-500/40 bg-slate-900/90 space-y-4 shadow-glass relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-glow">
                  {selectedParticipant?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Tagihan {selectedParticipant?.name}
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Proporsional Pas (Deviasi Rp 0)
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedParticipantId(null)}
                className="text-xs text-slate-400 hover:text-white underline p-1"
              >
                Ganti Nama
              </button>
            </div>

            {/* Items Consumed by this Guest */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Menu Yang Kamu Pesan:
              </span>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(selectedBreakdown.items || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">Belum ada menu yang ditandai untuk nama ini.</p>
                ) : (
                  selectedBreakdown.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{item.name}</span>
                        {item.splitRatio < 0.99 && (
                          <span className="text-[10px] text-brand-400 block font-mono">Porsi {(item.splitRatio * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-300">
                        Rp {Math.round(item.portionPrice || item.totalItemPrice || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Extra Charges breakdown (Tax, SC, Discount) */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Subtotal Makanan:</span>
                <span className="text-slate-200 font-semibold">Rp {(selectedBreakdown.rawSubtotal || 0).toLocaleString('id-ID')}</span>
              </div>
              {selectedBreakdown.roundedTax > 0 && (
                <div className="flex justify-between">
                  <span>+ Porsi Pajak PB1/PPN:</span>
                  <span>Rp {selectedBreakdown.roundedTax.toLocaleString('id-ID')}</span>
                </div>
              )}
              {selectedBreakdown.roundedService > 0 && (
                <div className="flex justify-between">
                  <span>+ Porsi Service Charge:</span>
                  <span>Rp {selectedBreakdown.roundedService.toLocaleString('id-ID')}</span>
                </div>
              )}
              {selectedBreakdown.roundedDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>- Porsi Diskon:</span>
                  <span>-Rp {selectedBreakdown.roundedDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {selectedBreakdown.roundingAdjustment !== 0 && selectedBreakdown.roundingAdjustment !== undefined && (
                <div className="flex justify-between text-amber-400">
                  <span>Penyesuaian Selisih:</span>
                  <span>{selectedBreakdown.roundingAdjustment > 0 ? '+' : ''}Rp {selectedBreakdown.roundingAdjustment.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Grand Total Box */}
            <div className="p-4 rounded-2xl bg-brand-500/15 border-2 border-brand-500/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-brand-400">Total Yang Harus Ditransfer:</span>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  Rp {(selectedBreakdown.finalTotal || selectedBreakdown.initialRoundedTotal || 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Host Multi-Payment Options Card */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3.5 shadow-glass">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Pilih Cara Transfer ke Host
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {paymentMethods.length} Pilihan
              </span>
            </div>

            {/* Payment Method Selector Tabs */}
            {paymentMethods.length > 1 && (
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {paymentMethods.map((pm, idx) => (
                  <button
                    key={pm.id || idx}
                    type="button"
                    onClick={() => setSelectedPaymentIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedPaymentIndex === idx
                        ? 'bg-brand-500 text-slate-950 shadow-glow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>{pm.type === 'BANK' ? '🏦' : pm.type === 'EWALLET' ? '📱' : '🖼️'}</span>
                    <span>{pm.provider}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Payment Details Card */}
            <div className="space-y-3 text-xs">
              {activePayment.type !== 'QRIS' ? (
                <div className="flex justify-between items-center bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-[11px] text-brand-400 font-semibold block">
                      {activePayment.provider} ({activePayment.type === 'BANK' ? 'Transfer Bank' : 'E-Wallet'})
                    </span>
                    <span className="text-base font-bold font-mono text-white tracking-wider">
                      {activePayment.accountNumber}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      a.n. {activePayment.accountHolder}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopyRekening(activePayment.accountNumber, activePayment.id)}
                    className="px-3.5 py-2.5 rounded-xl bg-brand-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-brand-600 transition shadow-glow shrink-0"
                  >
                    {copiedRekening === (activePayment.id || activePayment.accountNumber) ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin No.</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* QRIS Image Display */
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                  <span className="text-xs font-bold text-white block">Scan QRIS Host dari M-Banking / E-Wallet</span>
                  {activePayment.imageUrl ? (
                    <div className="p-2 bg-white rounded-xl inline-block shadow-lg mx-auto">
                      <img src={activePayment.imageUrl} alt="QRIS Host" className="w-48 h-48 object-contain rounded-lg" />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic py-4">Foto QRIS belum diunggah oleh host.</p>
                  )}
                  <p className="text-[11px] text-slate-400">Screenshot gambar QRIS ini lalu buka di aplikasi e-wallet Anda.</p>
                </div>
              )}
            </div>

            {/* Confirm Paid Action */}
            <button
              onClick={handleConfirmPaid}
              disabled={isConfirmedPaid}
              className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                isConfirmedPaid
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-glow'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isConfirmedPaid ? '✅ Sudah Ditandai Lunas / Ditransfer' : 'Konfirmasi Saya Sudah Transfer'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
