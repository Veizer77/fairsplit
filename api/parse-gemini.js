// Vercel Serverless Function: /api/parse-gemini proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg', apiKey: bodyApiKey } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar struk tidak boleh kosong.' });
  }

  // Header or Body key from client, or Server Environment Variable
  const authHeader = req.headers.authorization || '';
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const apiKey = bodyApiKey || bearerKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Vercel Dashboard -> Settings -> Environment Variables, atau masukkan API Key di menu Pengaturan aplikasi.'
    });
  }

  // Official active Google Gemini models for Vision/Multimodal
  const models = [
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
  ];

  const prompt = `You are a professional Indonesian restaurant receipt parser (GoPay Split Bill quality).
Extract only real food and beverage items, quantities, prices, subtotal, tax (PB1/PPN), service charge, discount, and grand total from this image.
Ignore order numbers, dates, times, table numbers, cashier names, payment methods, and change/kembalian lines.
Output strictly valid JSON with schema:
{
  "restaurant_name": "string or null",
  "subtotal": 0,
  "tax": 0,
  "service_charge": 0,
  "discount": 0,
  "grand_total": 0,
  "items": [
    { "name": "string", "qty": 1, "price_per_unit": 0, "total_price": 0 }
  ]
}`;

  let lastGoogleError = null;

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
          return res.status(200).json({ structuredData: structured, model });
        }
      } else {
        const errJson = await geminiRes.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${geminiRes.status}`;
        lastGoogleError = `${model}: ${errMsg}`;
        console.warn(`[GEMINI PROXY] Model ${model} error:`, errMsg);

        // If auth error, don't keep trying other models with same invalid key
        if (geminiRes.status === 400 || geminiRes.status === 401 || geminiRes.status === 403) {
          return res.status(geminiRes.status).json({
            error: `Google Gemini API Authentication Failed (${geminiRes.status}): ${errMsg}. Pastikan API Key Anda valid (diawali AIzaSy...) dari https://aistudio.google.com.`
          });
        }
      }
    } catch (e) {
      lastGoogleError = `${model}: ${e.message}`;
      console.warn(`[GEMINI PROXY] Fetch error for ${model}:`, e.message);
    }
  }

  return res.status(502).json({
    error: `Gagal memproses gambar dengan Gemini Vision API. Detail: ${lastGoogleError || 'Semua model gagal merespons.'}`
  });
}
