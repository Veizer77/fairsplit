/**
 * FairSplit Backend API Server
 * Ephemeral Storage with 24-Hour TTL (86400s) + Groq Parsing Proxy
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(distPath));

// In-Memory ephemeral KV store with TTL 24 hours (86,400,000 ms)
const sessionStore = new Map();
const TTL_MS = 86400 * 1000;

// Periodic cleanup of expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(id);
      console.log(`[EXPIRED] Session ${id} deleted.`);
    }
  }
}, 10 * 60 * 1000);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessionStore.size,
    uptime: process.uptime()
  });
});

// POST /api/bill - Create ephemeral bill session
app.post('/api/bill', (req, res) => {
  const id = req.body.id || nanoid(8);
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
    claimedBy: req.body.claimedBy || {},
    ...req.body
  };

  sessionStore.set(id, session);
  console.log(`[SESSION CREATED] ${id}, expires in 24h`);
  res.status(201).json({ success: true, id, session });
});

// GET /api/bill/:id - Retrieve ephemeral bill
app.get('/api/bill/:id', (req, res) => {
  const { id } = req.params;
  const session = sessionStore.get(id);

  if (!session) {
    return res.status(404).json({ error: 'Sesi split bill tidak ditemukan atau telah kedaluwarsa (24 jam).' });
  }

  if (Date.now() > session.expiresAt) {
    sessionStore.delete(id);
    return res.status(410).json({ error: 'Sesi telah kedaluwarsa.' });
  }

  res.json(session);
});

// PATCH /api/bill/:id/claim - Guest self-claim items
app.patch('/api/bill/:id/claim', (req, res) => {
  const { id } = req.params;
  const { guestName, itemIds } = req.body;

  if (!guestName) {
    return res.status(400).json({ error: 'Nama tamu wajib diisi.' });
  }

  const session = sessionStore.get(id);
  if (!session) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }

  if (!session.claimedBy) session.claimedBy = {};
  session.claimedBy[guestName] = Array.isArray(itemIds) ? itemIds : [];

  // Ensure guest exists in participants list
  let participant = session.participants.find(p => p.name.toLowerCase() === guestName.toLowerCase());
  if (!participant) {
    participant = {
      id: `p_guest_${nanoid(6)}`,
      name: guestName,
      is_paid: 0
    };
    session.participants.push(participant);
  }

  // Recalculate allocations for claimed items
  // Remove existing allocations for this participant
  session.allocations = session.allocations.filter(a => a.participant_id !== participant.id);

  // Add new allocations
  itemIds.forEach(itemId => {
    session.allocations.push({
      id: `alloc_${nanoid(6)}`,
      item_id: itemId,
      participant_id: participant.id,
      split_ratio: 1.0
    });
  });

  // Re-balance multi-claim split ratios
  const itemClaims = {};
  session.allocations.forEach(a => {
    if (!itemClaims[a.item_id]) itemClaims[a.item_id] = [];
    itemClaims[a.item_id].push(a);
  });

  Object.values(itemClaims).forEach(allocList => {
    const ratio = 1.0 / allocList.length;
    allocList.forEach(a => a.split_ratio = ratio);
  });

  console.log(`[CLAIM UPDATED] Guest "${guestName}" claimed ${itemIds.length} items on bill ${id}`);
  res.json({ success: true, session });
});

// POST /api/parse-receipt - Server-side Groq parser proxy
app.post('/api/parse-receipt', async (req, res) => {
  const { rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: 'Teks OCR struk tidak boleh kosong.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // If no server-side Groq key configured, return indicator to use client-side or regex
    return res.status(503).json({ error: 'Server GROQ_API_KEY belum dikonfigurasi. Gunakan input kunci di menu pengaturan atau offline parser.' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a precise receipt parser. Extract items, prices, quantities, taxes, service charges, discounts, and total from the given OCR text. Output strictly valid JSON without markdown wrapping.'
          },
          { role: 'user', content: rawText }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(groqRes.status).json({ error: errText });
    }

    const data = await groqRes.json();
    const content = data.choices[0]?.message?.content;
    const structured = JSON.parse(content);
    res.json({ structuredData: structured });
  } catch (err) {
    console.error('Groq proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/parse-gemini - Server-side Gemini Multimodal Vision proxy
app.post('/api/parse-gemini', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar struk tidak boleh kosong.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  const models = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite'
  ];

  const prompt = `You are a professional Indonesian restaurant receipt parser (GoPay Split Bill quality).
Extract only real food/drink items, quantities, prices, subtotal, tax (PB1/PPN), service charge, discount, and grand total from this image.
Ignore dates, times, table numbers, cashier names, and payment/kembalian lines.
Output strictly valid JSON matching this schema:
{
  "restaurant_name": "string or null",
  "subtotal": 0,
  "service_charge": 0,
  "tax": 0,
  "discount": 0,
  "grand_total": 0,
  "items": [
    {
      "name": "string",
      "qty": 1,
      "price_per_unit": 0,
      "total_price": 0
    }
  ]
}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1
          }
        })
      });

      if (geminiRes.ok) {
        const json = await geminiRes.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const structured = JSON.parse(rawText);
          return res.json({ structuredData: structured, model });
        }
      }
    } catch (e) {
      console.warn(`Gemini server proxy ${model} failed:`, e.message);
    }
  }

  res.status(502).json({ error: 'Gagal memproses gambar dengan Gemini Vision API.' });
});

// Wildcard SPA route fallback for React Router (e.g. /b/:sessionId, /)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 FairSplit Server running on port ${PORT}`);
});
