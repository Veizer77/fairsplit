// Vercel Serverless Function: Unified Bill API Handler (/api/bill, /api/bill/[id], /api/bill?id=...)
export const sessionStore = globalThis.__FAIRSPLIT_VERCEL_STORE__ || (globalThis.__FAIRSPLIT_VERCEL_STORE__ = new Map());
const TTL_MS = 86400 * 1000;

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract ID from query param or URL path or body
  const queryId = req.query?.id;
  let pathId = null;
  if (req.url) {
    const cleanUrl = req.url.split('?')[0];
    const match = cleanUrl.match(/\/api\/bill\/([^/]+)/);
    if (match) pathId = match[1];
  }
  const id = queryId || pathId || req.body?.id;

  if (req.method === 'GET') {
    if (!id) {
      return res.status(400).json({ error: 'ID sesi wajib disertakan.' });
    }
    const session = sessionStore.get(id);
    if (!session) {
      return res.status(404).json({ error: 'Sesi split bill tidak ditemukan atau telah kedaluwarsa (24 jam).' });
    }
    if (Date.now() > session.expiresAt) {
      sessionStore.delete(id);
      return res.status(410).json({ error: 'Sesi telah kedaluwarsa (24 jam).' });
    }
    return res.json(session);
  }

  if (req.method === 'POST') {
    const sessionId = req.body.id || Math.random().toString(36).substring(2, 10);
    const now = Date.now();
    const session = {
      id: sessionId,
      createdAt: now,
      expiresAt: now + TTL_MS,
      restaurantName: req.body.restaurantName || 'Restoran',
      receipt: req.body.receipt || {},
      participants: req.body.participants || [],
      allocations: req.body.allocations || [],
      calculation: req.body.calculation || null,
      hostBank: req.body.hostBank || 'BCA',
      accountNumber: req.body.accountNumber || '',
      accountHolder: req.body.accountHolder || 'Host',
      qrisImageUrl: req.body.qrisImageUrl || '',
      paymentMethods: req.body.paymentMethods || [],
      claimedBy: req.body.claimedBy || {},
      ...req.body
    };

    sessionStore.set(sessionId, session);
    return res.status(201).json({ success: true, id: sessionId, session });
  }

  if (req.method === 'PATCH') {
    if (!id) {
      return res.status(400).json({ error: 'ID sesi wajib disertakan.' });
    }
    const session = sessionStore.get(id);
    if (!session) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    }

    const { guestName, itemIds } = req.body || {};
    if (guestName) {
      if (!session.claimedBy) session.claimedBy = {};
      session.claimedBy[guestName] = itemIds || [];
    }

    return res.json({ success: true, session });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
