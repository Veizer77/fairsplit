// Vercel Serverless Function: /api/parse-gemini proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Gambar struk tidak boleh kosong.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  const models = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview'
  ];

  const prompt = `You are a professional Indonesian restaurant receipt parser.
Extract only real food/drink items, quantities, prices, subtotal, tax (PB1/PPN), service charge, discount, and grand total.
Output strictly valid JSON with schema:
{
  "restaurant_name": "string",
  "subtotal": 0,
  "tax": 0,
  "service_charge": 0,
  "discount": 0,
  "grand_total": 0,
  "items": [
    { "id": "1", "name": "Item name", "qty": 1, "price_per_unit": 0, "total_price": 0 }
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
          return res.status(200).json({ structuredData: structured, model });
        }
      }
    } catch (e) {
      console.warn(`Gemini Vercel proxy ${model} failed:`, e.message);
    }
  }

  res.status(502).json({ error: 'Gagal memproses gambar dengan Gemini Vision API.' });
}
