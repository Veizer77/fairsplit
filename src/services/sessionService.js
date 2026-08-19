/**
 * Ephemeral Session Sync & WhatsApp Summary Generation Service
 */

import { nanoid } from 'nanoid';

export function formatWhatsAppMessage({
  calculation,
  hostBank = 'BCA',
  accountNumber = '1234567890',
  accountHolder = 'Host',
  paymentMethods = [],
  claimUrl = ''
}) {
  if (!calculation) return '';

  const {
    restaurantName = 'Restoran',
    grandTotal = 0,
    tax = 0,
    serviceCharge = 0,
    discount = 0,
    breakdowns = []
  } = calculation;

  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  let msg = `🧾 *RINCIAN SPLIT BILL — ${restaurantName.toUpperCase()}*\n`;
  msg += `📅 ${dateStr}\n`;
  msg += `─────────────────────────\n\n`;

  msg += `💰 *Ringkasan Tagihan Struk:*\n`;
  msg += `• Grand Total: *Rp ${grandTotal.toLocaleString('id-ID')}*\n`;
  if (tax > 0) msg += `• Pajak (PB1/PPN): Rp ${tax.toLocaleString('id-ID')}\n`;
  if (serviceCharge > 0) msg += `• Service Charge: Rp ${serviceCharge.toLocaleString('id-ID')}\n`;
  if (discount > 0) msg += `• Diskon/Promo: -Rp ${discount.toLocaleString('id-ID')}\n`;
  msg += `\n⚖️ *Pembagian Tagihan Per Orang:*\n`;

  breakdowns.forEach((b, idx) => {
    const status = b.isPaid ? '✅ (LUNAS)' : '⏳ (BELUM BAYAR)';
    msg += `\n*${idx + 1}. ${b.name}* ${status}\n`;
    (b.items || []).forEach(item => {
      const splitText = item.splitRatio < 0.99 ? ` (Porsi ${(item.splitRatio * 100).toFixed(0)}%)` : '';
      const price = item.portionPrice || item.totalItemPrice || 0;
      msg += `   - ${item.name}${splitText}: Rp ${Math.round(price).toLocaleString('id-ID')}\n`;
    });
    if (b.roundedTax > 0) msg += `   + Pajak: Rp ${b.roundedTax.toLocaleString('id-ID')}\n`;
    if (b.roundedService > 0) msg += `   + Servis: Rp ${b.roundedService.toLocaleString('id-ID')}\n`;
    if (b.roundedDiscount > 0) msg += `   - Diskon: Rp ${b.roundedDiscount.toLocaleString('id-ID')}\n`;
    if (b.roundingAdjustment !== 0 && b.roundingAdjustment !== undefined) {
      msg += `   * Penyesuaian Pembulatan: ${b.roundingAdjustment > 0 ? '+' : ''}Rp ${b.roundingAdjustment.toLocaleString('id-ID')}\n`;
    }
    msg += `   👉 *TOTAL TRANSFER: Rp ${(b.finalTotal || b.initialRoundedTotal || 0).toLocaleString('id-ID')}*\n`;
  });

  msg += `\n─────────────────────────\n`;
  msg += `💳 *Informasi Rekening Pembayaran:*\n`;
  if (paymentMethods && paymentMethods.length > 0) {
    paymentMethods.forEach((pm) => {
      if (pm.type !== 'QRIS') {
        msg += `• *${pm.provider}*: ${pm.accountNumber} (a.n. ${pm.accountHolder})\n`;
      }
    });
  } else {
    msg += `• Bank/E-Wallet: *${hostBank}*\n`;
    msg += `• No. Rekening/HP: *${accountNumber}*\n`;
    msg += `• Atas Nama: *${accountHolder}*\n`;
  }

  if (claimUrl) {
    msg += `\n🔗 *Tautan Klaim Pesanan Mandiri (24 Jam):*\n${claimUrl}\n`;
  }

  msg += `\n✨ Dihitung otomatis & adil dengan *FairSplit*`;
  return msg;
}

export async function createEphemeralSession(sessionData) {
  const sessionId = nanoid(8);
  const payload = {
    id: sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400 * 1000, // 24 hours TTL
    ...sessionData
  };

  try {
    const res = await fetch('/api/bill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return { id: data.id || sessionId, payload };
    }
  } catch (e) {
    console.warn('Backend ephemeral sync unavailable, using local memory session:', e.message);
  }

  // Fallback memory / local storage
  const memoryStore = globalThis.__FAIRSPLIT_STORE__ || (globalThis.__FAIRSPLIT_STORE__ = new Map());
  memoryStore.set(`ephemeral_bill_${sessionId}`, JSON.stringify(payload));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`ephemeral_bill_${sessionId}`, JSON.stringify(payload));
    } catch {}
  }
  return { id: sessionId, payload };
}

export async function fetchEphemeralSession(sessionId) {
  try {
    const res = await fetch(`/api/bill/${sessionId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Expected in test / offline
  }

  const memoryStore = globalThis.__FAIRSPLIT_STORE__;
  const inMem = memoryStore?.get(`ephemeral_bill_${sessionId}`);
  if (inMem) return JSON.parse(inMem);

  if (typeof localStorage !== 'undefined') {
    try {
      const local = localStorage.getItem(`ephemeral_bill_${sessionId}`);
      if (local) return JSON.parse(local);
    } catch {}
  }
  return null;
}

export async function claimGuestItems(sessionId, { guestName, itemIds }) {
  try {
    const res = await fetch(`/api/bill/${sessionId}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName, itemIds })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Expected in offline fallback
  }

  const memoryStore = globalThis.__FAIRSPLIT_STORE__ || (globalThis.__FAIRSPLIT_STORE__ = new Map());
  let localData = memoryStore.get(`ephemeral_bill_${sessionId}`);
  if (!localData && typeof localStorage !== 'undefined') {
    try {
      localData = localStorage.getItem(`ephemeral_bill_${sessionId}`);
    } catch {}
  }

  if (localData) {
    const data = typeof localData === 'string' ? JSON.parse(localData) : localData;
    if (!data.claimedBy) data.claimedBy = {};
    data.claimedBy[guestName] = itemIds;
    
    memoryStore.set(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
      } catch {}
    }
    return data;
  }
  throw new Error('Sesi tidak ditemukan.');
}
