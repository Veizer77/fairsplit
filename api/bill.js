// Vercel Serverless Function: In-Memory / Global Sessi Store
const sessionStore = globalThis.__FAIRSPLIT_VERCEL_STORE__ || (globalThis.__FAIRSPLIT_VERCEL_STORE__ = new Map());
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
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const id = req.body.id || Math.random().toString(36).substring(2, 10);
    const now = Date.now();
    const session = {
      id,
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

    sessionStore.set(id, session);
    return res.status(201).json({ success: true, id, session });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
