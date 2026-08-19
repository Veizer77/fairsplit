// Vercel Serverless Function: /api/bill/[id]
const sessionStore = globalThis.__FAIRSPLIT_VERCEL_STORE__ || (globalThis.__FAIRSPLIT_VERCEL_STORE__ = new Map());

export default function handler(req, res) {
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

  const { id } = req.query;
  const session = sessionStore.get(id);

  if (req.method === 'GET') {
    if (!session) {
      return res.status(404).json({ error: 'Sesi split bill tidak ditemukan atau telah kedaluwarsa (24 jam).' });
    }
    return res.json(session);
  }

  if (req.method === 'PATCH') {
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

  res.status(405).json({ error: 'Method not allowed' });
}
