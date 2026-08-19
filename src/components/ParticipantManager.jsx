import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Check, ArrowRight, UserCheck, AlertCircle, Sparkles, Plus, Minus, Lock, CheckCircle2, ChevronRight } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-emerald-500 text-slate-950',
  'bg-sky-500 text-slate-950',
  'bg-amber-500 text-slate-950',
  'bg-violet-500 text-white',
  'bg-rose-500 text-white',
  'bg-teal-500 text-slate-950',
  'bg-indigo-500 text-white',
  'bg-fuchsia-500 text-white'
];

export default function ParticipantManager({
  receipt,
  participants,
  allocations,
  onUpdateParticipants,
  onUpdateAllocations,
  onProceed,
  onBack
}) {
  const [newMemberName, setNewMemberName] = useState('');
  const [activeParticipantId, setActiveParticipantId] = useState(participants[0]?.id || 'p_1');

  // items from receipt
  const items = receipt?.items || [];

  // Internal claim state map: userClaims[participantId][itemId] = quantity claimed
  const [userClaims, setUserClaims] = useState(() => {
    const map = {};
    participants.forEach(p => {
      map[p.id] = {};
    });

    // Populate from incoming allocations
    allocations.forEach(alloc => {
      if (!map[alloc.participant_id]) map[alloc.participant_id] = {};
      const item = items.find(i => i.id === alloc.item_id);
      const totalQty = item ? Math.max(1, item.qty || 1) : 1;
      const portionQty = alloc.claimed_qty || Math.max(1, Math.round((alloc.split_ratio || 1) * totalQty));
      map[alloc.participant_id][alloc.item_id] = portionQty;
    });

    return map;
  });

  // Keep activeParticipantId valid
  useEffect(() => {
    if (!participants.some(p => p.id === activeParticipantId) && participants.length > 0) {
      setActiveParticipantId(participants[0].id);
    }
  }, [participants, activeParticipantId]);

  // Sync userClaims to parent allocations
  const syncToAllocations = (updatedClaims, updatedParticipants = participants) => {
    const newAllocs = [];

    items.forEach(item => {
      const itemTotalQty = Math.max(1, item.qty || 1);
      
      // Calculate total claimed across all members for this item
      let totalClaimed = 0;
      updatedParticipants.forEach(p => {
        const q = (updatedClaims[p.id] && updatedClaims[p.id][item.id]) || 0;
        totalClaimed += q;
      });

      if (totalClaimed > 0) {
        updatedParticipants.forEach(p => {
          const q = (updatedClaims[p.id] && updatedClaims[p.id][item.id]) || 0;
          if (q > 0) {
            // Ratio relative to item's total quantity
            const ratio = q / itemTotalQty;
            newAllocs.push({
              item_id: item.id,
              participant_id: p.id,
              split_ratio: ratio,
              claimed_qty: q
            });
          }
        });
      }
    });

    onUpdateAllocations(newAllocs);
  };

  // Add Participant
  const handleAddParticipant = (nameToAdd) => {
    const name = (nameToAdd || newMemberName).trim();
    if (!name) return;

    const newId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const updated = [...participants, { id: newId, name, is_paid: 0 }];

    const updatedClaims = {
      ...userClaims,
      [newId]: {}
    };

    setUserClaims(updatedClaims);
    onUpdateParticipants(updated);
    setActiveParticipantId(newId);
    setNewMemberName('');
    syncToAllocations(updatedClaims, updated);
  };

  // Remove Participant
  const handleRemoveParticipant = (idToRemove) => {
    if (participants.length <= 1) return;

    const updated = participants.filter(p => p.id !== idToRemove);
    const updatedClaims = { ...userClaims };
    delete updatedClaims[idToRemove];

    setUserClaims(updatedClaims);
    onUpdateParticipants(updated);

    if (activeParticipantId === idToRemove) {
      setActiveParticipantId(updated[0]?.id || '');
    }

    syncToAllocations(updatedClaims, updated);
  };

  // Change quantity of an item claimed by active participant
  const handleQuantityChange = (itemId, delta) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const totalQty = Math.max(1, item.qty || 1);
    const currentMemberQty = (userClaims[activeParticipantId] && userClaims[activeParticipantId][itemId]) || 0;

    // Calculate how many claimed by OTHER participants
    let otherClaimed = 0;
    participants.forEach(p => {
      if (p.id !== activeParticipantId) {
        otherClaimed += (userClaims[p.id] && userClaims[p.id][itemId]) || 0;
      }
    });

    const maxAllowedForActive = Math.max(0, totalQty - otherClaimed);
    const targetQty = Math.max(0, Math.min(maxAllowedForActive, currentMemberQty + delta));

    const updatedClaims = {
      ...userClaims,
      [activeParticipantId]: {
        ...(userClaims[activeParticipantId] || {}),
        [itemId]: targetQty
      }
    };

    // If 0, delete key for cleanliness
    if (targetQty === 0) {
      delete updatedClaims[activeParticipantId][itemId];
    }

    setUserClaims(updatedClaims);
    syncToAllocations(updatedClaims);
  };

  // Helper functions for item status
  const getItemStats = (itemId) => {
    const item = items.find(i => i.id === itemId);
    const totalQty = item ? Math.max(1, item.qty || 1) : 1;

    let totalClaimed = 0;
    const claimers = [];

    participants.forEach(p => {
      const q = (userClaims[p.id] && userClaims[p.id][itemId]) || 0;
      if (q > 0) {
        totalClaimed += q;
        claimers.push({ participant: p, qty: q });
      }
    });

    const activeMemberQty = (userClaims[activeParticipantId] && userClaims[activeParticipantId][itemId]) || 0;
    const remainingQty = Math.max(0, totalQty - totalClaimed);
    const isExhausted = remainingQty === 0;

    return {
      totalQty,
      totalClaimed,
      remainingQty,
      isExhausted,
      claimers,
      activeMemberQty
    };
  };

  // Calculate active participant's live subtotal
  const calculateParticipantSubtotal = (participantId) => {
    let sum = 0;
    items.forEach(item => {
      const q = (userClaims[participantId] && userClaims[participantId][item.id]) || 0;
      const unitPrice = item.price_per_unit || Math.round(item.total_price / Math.max(1, item.qty || 1));
      sum += q * unitPrice;
    });
    return sum;
  };

  // Total allocated items coverage
  let fullyClaimedCount = 0;
  items.forEach(item => {
    const stats = getItemStats(item.id);
    if (stats.isExhausted) fullyClaimedCount++;
  });
  const allFullyClaimed = items.length > 0 && fullyClaimedCount === items.length;

  const activeParticipant = participants.find(p => p.id === activeParticipantId) || participants[0];
  const activeSubtotal = calculateParticipantSubtotal(activeParticipant?.id);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 1. Header & Member Management */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 shadow-glass">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-400" />
              <span>Daftar Anggota Rombongan</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tambah teman yang ikut makan, lalu pilih item pesanan untuk setiap orang di bawah.
            </p>
          </div>

          {/* Quick Add Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddParticipant();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Nama Teman (misal: Budi)"
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none w-48 sm:w-56"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs transition shadow-glow flex items-center gap-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah</span>
            </button>
          </form>
        </div>
      </div>

      {/* 2. Member Selector Carousel / Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Langkah 2: Pilih Anggota Aktif Untuk Menandai Pesanan
          </span>
          <span className="text-xs text-brand-400 font-medium font-mono">
            {participants.length} Anggota
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {participants.map((p, idx) => {
            const isActive = p.id === activeParticipantId;
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const pSubtotal = calculateParticipantSubtotal(p.id);
            const claimedItemsCount = Object.values(userClaims[p.id] || {}).filter(q => q > 0).length;

            return (
              <div
                key={p.id}
                onClick={() => setActiveParticipantId(p.id)}
                className={`relative p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-slate-900 border-brand-500 shadow-glow ring-2 ring-brand-500/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl ${colorClass} flex items-center justify-center font-bold text-xs shadow-sm`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className={`font-bold text-xs truncate max-w-[90px] ${isActive ? 'text-white' : 'text-slate-300'}`}>
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {claimedItemsCount} menu
                      </p>
                    </div>
                  </div>

                  {participants.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveParticipant(p.id);
                      }}
                      className="text-slate-600 hover:text-rose-400 transition p-1"
                      title="Hapus anggota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Subtotal:</span>
                  <span className={`text-xs font-bold font-mono ${pSubtotal > 0 ? 'text-brand-400' : 'text-slate-500'}`}>
                    Rp {pSubtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Item Selection Card for Active Member */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4 shadow-glass">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Menandai pesanan untuk:</span>
              <span className="font-bold text-white text-sm bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-md">
                {activeParticipant?.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Gunakan tombol (+) untuk memilih porsi. Item yang sudah diambil teman lain akan otomatis berstatus <strong>"Habis"</strong>.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Sementara {activeParticipant?.name}:</span>
            <div className="text-lg font-black font-mono text-brand-400">
              Rp {activeSubtotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Item Rows Grid */}
        <div className="space-y-3">
          {items.map((item) => {
            const stats = getItemStats(item.id);
            const unitPrice = item.price_per_unit || Math.round(item.total_price / Math.max(1, item.qty || 1));
            const isSelectedByActive = stats.activeMemberQty > 0;
            const isLockedOut = stats.isExhausted && !isSelectedByActive;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelectedByActive
                    ? 'bg-brand-500/10 border-brand-500/80 shadow-glow'
                    : isLockedOut
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left: Item Info & Status Badges */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-white">
                      {item.name}
                    </span>

                    {/* Status Pill */}
                    {isSelectedByActive && (
                      <span className="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-400 text-[10px] font-bold border border-brand-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{stats.activeMemberQty}x Porsi Dipilih</span>
                      </span>
                    )}

                    {isLockedOut && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>🔒 Habis</span>
                      </span>
                    )}

                    {!isLockedOut && !isSelectedByActive && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                        Tersedia: {stats.remainingQty} dari {stats.totalQty} porsi
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>@ Rp {unitPrice.toLocaleString('id-ID')}</span>
                    <span>•</span>
                    <span>Total Struk: {stats.totalQty}x (Rp {item.total_price.toLocaleString('id-ID')})</span>
                  </div>

                  {/* Who Claimed Summary */}
                  {stats.claimers.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-400 flex-wrap">
                      <span className="text-slate-500">Peminat:</span>
                      {stats.claimers.map(({ participant, qty }) => (
                        <span
                          key={participant.id}
                          className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[10px]"
                        >
                          {participant.name} ({qty}x)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Quantity Stepper */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      disabled={stats.activeMemberQty <= 0}
                      onClick={() => handleQuantityChange(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center transition"
                      title="Kurangi porsi"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="w-8 text-center font-mono font-bold text-sm text-white">
                      {stats.activeMemberQty}
                    </span>

                    <button
                      type="button"
                      disabled={stats.remainingQty <= 0}
                      onClick={() => handleQuantityChange(item.id, +1)}
                      className="w-8 h-8 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold flex items-center justify-center transition shadow-glow"
                      title={stats.remainingQty <= 0 ? 'Porsi sudah habis' : 'Tambah porsi'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Allocation Progress & Proceed Navigation */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 shadow-glass">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Status Alokasi Struk:</span>
            <span className={`font-semibold ${allFullyClaimed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {fullyClaimedCount} dari {items.length} menu telah terbagi habis ({Math.round((fullyClaimedCount / Math.max(1, items.length)) * 100)}%)
            </span>
          </div>

          {!allFullyClaimed && (
            <span className="text-[11px] text-amber-400 font-medium">
              ⚠️ Masih ada menu yang belum terbagi
            </span>
          )}
        </div>

        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`h-full transition-all duration-300 ${allFullyClaimed ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${(fullyClaimedCount / Math.max(1, items.length)) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-semibold text-xs transition"
          >
            Kembali ke Review Struk
          </button>

          <button
            type="button"
            onClick={onProceed}
            className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-sm transition shadow-glow flex items-center gap-2"
          >
            <span>Hitung & Selesaikan Pembagian</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
