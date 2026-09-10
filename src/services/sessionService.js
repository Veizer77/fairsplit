/**
 * Ephemeral Session Sync & WhatsApp Summary Generation Service
 * Includes client-side stateless token encoding to ensure 100% reliable QR code & link sharing
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

/**
 * Compact representation of session without heavy image base64 data
 */
export function serializeSessionPayload(obj) {
  if (!obj) return null;
  return {
    id: obj.id,
    createdAt: obj.createdAt || Date.now(),
    expiresAt: obj.expiresAt || (Date.now() + 86400 * 1000),
    restaurantName: obj.restaurantName || 'Restoran',
    receipt: {
      restaurant_name: obj.receipt?.restaurant_name || obj.restaurantName || 'Restoran',
      subtotal: obj.receipt?.subtotal || 0,
      tax: obj.receipt?.tax || 0,
      service_charge: obj.receipt?.service_charge || 0,
      discount: obj.receipt?.discount || 0,
      grand_total: obj.receipt?.grand_total || 0,
      items: (obj.receipt?.items || []).map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty || 1,
        price_per_unit: i.price_per_unit || i.price || 0,
        total_price: i.total_price || ((i.price_per_unit || i.price || 0) * (i.qty || 1))
      }))
    },
    participants: (obj.participants || []).map(p => ({
      id: p.id,
      name: p.name,
      is_paid: p.is_paid || 0
    })),
    allocations: (obj.allocations || []).map(a => ({
      id: a.id,
      item_id: a.item_id,
      participant_id: a.participant_id,
      split_ratio: a.split_ratio
    })),
    calculation: obj.calculation ? {
      grandTotal: obj.calculation.grandTotal || obj.receipt?.grand_total || 0,
      tax: obj.calculation.tax || obj.receipt?.tax || 0,
      serviceCharge: obj.calculation.serviceCharge || obj.receipt?.service_charge || 0,
      discount: obj.calculation.discount || obj.receipt?.discount || 0,
      breakdowns: (obj.calculation.breakdowns || []).map(b => ({
        participantId: b.participantId,
        name: b.name,
        rawSubtotal: b.rawSubtotal || 0,
        roundedTax: b.roundedTax || 0,
        roundedService: b.roundedService || 0,
        roundedDiscount: b.roundedDiscount || 0,
        roundingAdjustment: b.roundingAdjustment || 0,
        finalTotal: b.finalTotal || b.initialRoundedTotal || 0,
        items: (b.items || []).map(it => ({
          name: it.name,
          portionPrice: it.portionPrice || it.totalItemPrice || 0,
          splitRatio: it.splitRatio || 1
        }))
      }))
    } : null,
    hostBank: obj.hostBank || 'BCA',
    accountNumber: obj.accountNumber || '',
    accountHolder: obj.accountHolder || 'Host',
    paymentMethods: (obj.paymentMethods || []).map(pm => ({
      id: pm.id,
      type: pm.type,
      provider: pm.provider,
      accountNumber: pm.accountNumber || '',
      accountHolder: pm.accountHolder || '',
      isPrimary: pm.isPrimary
    })),
    claimedBy: obj.claimedBy || {}
  };
}

export async function compressAndEncode(obj) {
  try {
    const json = JSON.stringify(obj);
    if (typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buffer = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return 'c.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } else {
      const bytes = new TextEncoder().encode(json);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return 'r.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  } catch (e) {
    console.warn('compressAndEncode error:', e);
    return '';
  }
}

export async function decodeAndDecompress(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    let type = 'r';
    let rawToken = token;
    if (token.startsWith('c.')) {
      type = 'c';
      rawToken = token.slice(2);
    } else if (token.startsWith('r.')) {
      type = 'r';
      rawToken = token.slice(2);
    }

    let b64 = rawToken.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    if (type === 'c' && typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    } else {
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    }
  } catch (e) {
    console.warn('decodeAndDecompress error:', e);
    return null;
  }
}

export function extractTokenFromUrl(urlOrLocation) {
  try {
    const loc = urlOrLocation || (typeof window !== 'undefined' ? window.location : null);
    if (!loc) return null;

    const hash = loc.hash || '';
    const hashMatch = hash.match(/[#&]d(?:ata)?=([^&]+)/);
    if (hashMatch) return decodeURIComponent(hashMatch[1]);

    if (hash.startsWith('#c.') || hash.startsWith('#r.')) {
      return hash.slice(1);
    }

    const search = loc.search || '';
    if (search) {
      const params = new URLSearchParams(search);
      const val = params.get('d') || params.get('data');
      if (val) return val;
    }
  } catch (err) {
    console.warn('Failed to extract token from URL:', err);
  }
  return null;
}

export async function createEphemeralSession(sessionData, apiBase = '') {
  const sessionId = sessionData.id || nanoid(8);
  const now = Date.now();
  const payload = {
    id: sessionId,
    createdAt: now,
    expiresAt: now + 86400 * 1000, // 24 hours TTL
    ...sessionData
  };

  const compact = serializeSessionPayload(payload);
  const token = await compressAndEncode(compact);

  const base = (apiBase || '').trim().replace(/\/+$/, '');
  const targetUrl = base ? `${base}/api/bill` : '/api/bill';

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return { id: data.id || sessionId, payload, token };
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
  return { id: sessionId, payload, token };
}

export async function fetchEphemeralSession(sessionId, apiBase = '', preferRemote = false) {
  const base = (apiBase || '').trim().replace(/\/+$/, '');
  const remoteUrl = base ? `${base}/api/bill/${sessionId}` : `/api/bill/${sessionId}`;

  // Helper to query remote server
  const tryRemote = async () => {
    try {
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && (!data.expiresAt || Date.now() <= data.expiresAt)) {
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
            } catch {}
          }
          const memoryStore = globalThis.__FAIRSPLIT_STORE__ || (globalThis.__FAIRSPLIT_STORE__ = new Map());
          memoryStore.set(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
          return data;
        }
      }
    } catch {}
    return null;
  };

  // If preferRemote is true (polling or host check), try remote first
  if (preferRemote) {
    const remoteData = await tryRemote();
    if (remoteData) return remoteData;
  }

  // 1. Try resolving self-contained stateless token from URL hash or query
  const tokenFromUrl = extractTokenFromUrl();
  if (tokenFromUrl) {
    const decoded = await decodeAndDecompress(tokenFromUrl);
    if (decoded) {
      // Check 24-hour TTL expiration
      if (decoded.expiresAt && Date.now() > decoded.expiresAt) {
        return null;
      }
      // Cache decoded session in local storage and memory
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`ephemeral_bill_${sessionId}`, JSON.stringify(decoded));
        } catch {}
      }
      const memoryStore = globalThis.__FAIRSPLIT_STORE__ || (globalThis.__FAIRSPLIT_STORE__ = new Map());
      memoryStore.set(`ephemeral_bill_${sessionId}`, JSON.stringify(decoded));
      return decoded;
    }
  }

  // 2. Fetch from backend server / Vercel API endpoint (if not already tried)
  if (!preferRemote) {
    const remoteData = await tryRemote();
    if (remoteData) return remoteData;
  }

  // 3. Fallback to memory store
  const memoryStore = globalThis.__FAIRSPLIT_STORE__;
  const inMem = memoryStore?.get(`ephemeral_bill_${sessionId}`);
  if (inMem) {
    const parsed = typeof inMem === 'string' ? JSON.parse(inMem) : inMem;
    if (!parsed.expiresAt || Date.now() <= parsed.expiresAt) {
      return parsed;
    }
  }

  // 4. Fallback to browser localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const local = localStorage.getItem(`ephemeral_bill_${sessionId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (!parsed.expiresAt || Date.now() <= parsed.expiresAt) {
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}

export async function markParticipantPaid(sessionId, { participantId, isPaid = true, guestName = '' }, apiBase = '') {
  const payload = { participantId, isPaid, guestName };

  // 1. BroadcastChannel for instant 0ms local cross-tab sync
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('fairsplit_session_sync');
      bc.postMessage({ type: 'PAID_UPDATE', sessionId, ...payload });
      bc.close();
    }
  } catch {}

  // 2. Local memory / local storage update
  try {
    const memoryStore = globalThis.__FAIRSPLIT_STORE__;
    let data = null;
    const inMem = memoryStore?.get(`ephemeral_bill_${sessionId}`);
    if (inMem) {
      data = typeof inMem === 'string' ? JSON.parse(inMem) : inMem;
    } else if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(`ephemeral_bill_${sessionId}`);
      if (local) data = JSON.parse(local);
    }

    if (data) {
      if (!data.paidStatus) data.paidStatus = {};
      data.paidStatus[participantId] = isPaid;
      if (Array.isArray(data.participants)) {
        const p = data.participants.find(pt => pt.id === participantId);
        if (p) p.is_paid = isPaid ? 1 : 0;
      }
      if (memoryStore) memoryStore.set(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`ephemeral_bill_${sessionId}`, JSON.stringify(data));
      }
    }
  } catch {}

  // 3. Send PATCH to server
  const base = (apiBase || '').trim().replace(/\/+$/, '');
  const targetUrl = base ? `${base}/api/bill/${sessionId}/pay` : `/api/bill/${sessionId}/pay`;

  try {
    const res = await fetch(targetUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Try query param fallback
    try {
      const fallbackUrl = base ? `${base}/api/bill?id=${sessionId}` : `/api/bill?id=${sessionId}`;
      const res = await fetch(fallbackUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e2) {
      console.warn('markParticipantPaid server update failed:', e2.message);
    }
  }

  return { success: true, localOnly: true };
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
