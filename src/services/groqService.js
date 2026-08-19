/**
 * Groq API Service for Structured Indonesian Receipt Extraction
 * Model: llama-3.3-70b-versatile (Free Tier, Zero API Cost)
 * Strict JSON Contract Specification
 */

export const GROQ_SCHEMA = {
  restaurant_name: "string | null",
  subtotal: "number",
  service_charge: "number",
  tax: "number",
  discount: "number",
  grand_total: "number",
  items: [
    {
      name: "string",
      qty: "number",
      price_per_unit: "number",
      total_price: "number"
    }
  ]
};

export const GROQ_SYSTEM_PROMPT = `You are a professional restaurant receipt parser specialized in Indonesian dining receipts (GoPay Split Bill quality).
Your task is to extract only real purchased food and beverage items, restaurant name, subtotal, tax (PB1/PPN), service charge (SC), discount, and grand total.

CRITICAL RULES & EXCLUSIONS:
1. ONLY include actual consumed food, beverage, or dish items in "items".
2. DO NOT include metadata as items. NEVER treat the following as items or prices:
   - Dates & Timestamps (e.g., "19/08/2026", "14:35:10", "2026")
   - Table / Order / Bill / Invoice numbers (e.g., "Table 04", "Meja 12", "Bill #88123", "Trx ID")
   - Cashier / Waiter / Terminal lines (e.g., "Kasir: Hendra", "POS 1", "Pax: 4")
   - Payment method lines (e.g., "Cash 100.000", "Tunai", "BCA Debit", "QRIS", "GoPay")
   - Change / Kembalian lines (e.g., "Kembali Rp 18.200", "Change: 20.000")
   - Merchant contact / addresses / Wi-Fi (e.g., "Jl. Fatmawati", "Telp 08123...", "NPWP", "WiFi")
3. If an item spans two lines (e.g. name on line 1, price/qty on line 2), combine them into a single item.
4. Output clean integer numbers without "Rp", dots, or commas.
5. Output strictly valid JSON matching this schema without markdown wrapping:
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

export async function parseReceiptWithGroq(rawOcrText, apiKey = null) {
  if (!rawOcrText || rawOcrText.trim().length === 0) {
    throw new Error('Teks OCR kosong atau tidak terbaca.');
  }

  const startTime = performance.now();
  const effectiveKey = apiKey || (typeof process !== 'undefined' ? process.env?.VITE_GROQ_API_KEY : null) || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : null);

  // If no client API key, try local backend proxy endpoint
  const endpoint = effectiveKey 
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : '/api/parse-receipt';

  const headers = {
    'Content-Type': 'application/json'
  };
  if (effectiveKey) {
    headers['Authorization'] = `Bearer ${effectiveKey}`;
  }

  const bodyPayload = effectiveKey ? JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: GROQ_SYSTEM_PROMPT },
      { role: 'user', content: `Parse this receipt OCR text:\\n\\n${rawOcrText}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2048
  }) : JSON.stringify({ rawText: rawOcrText });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: bodyPayload
    });

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      if (status === 429) {
        const error = new Error('Groq API Rate Limit (429). Beralih ke offline parser.');
        error.code = 'RATE_LIMIT';
        error.latencyMs = latencyMs;
        throw error;
      }
      const error = new Error(`Groq API Error (${status}): ${errText}`);
      error.status = status;
      error.latencyMs = latencyMs;
      throw error;
    }

    const data = await response.json();
    let parsedResult;

    if (data.choices && data.choices[0]?.message?.content) {
      parsedResult = JSON.parse(data.choices[0].message.content);
    } else if (data.structuredData) {
      parsedResult = data.structuredData;
    } else {
      parsedResult = data;
    }

    const sanitized = sanitizeReceiptData(parsedResult);
    return {
      data: sanitized,
      latencyMs,
      source: 'GROQ_LLM',
      model: 'llama-3.3-70b-versatile'
    };
  } catch (err) {
    err.latencyMs = err.latencyMs || Math.round(performance.now() - startTime);
    throw err;
  }
}

export function cleanIndonesianNumber(v, defaultVal = 0) {
  if (typeof v === 'number') return isNaN(v) ? defaultVal : Math.abs(v);
  if (typeof v === 'string') {
    let clean = v.trim().replace(/rp|idr/gi, '').trim();
    if (!clean) return defaultVal;
    // Handles thousand separators like "150.000" or "150,000" or "1.500.000"
    if (/^[0-9]{1,3}(?:[.,][0-9]{3})+$/.test(clean)) {
      clean = clean.replace(/[.,]/g, '');
    } else if (/[.,]\d{2}$/.test(clean) && !/[.,]\d{3}/.test(clean)) {
      clean = clean.replace(/,/g, '.');
    } else {
      clean = clean.replace(/[.,](?=\d{3})/g, '').replace(/[^0-9.-]/g, '');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? defaultVal : Math.abs(parsed);
  }
  return defaultVal;
}

/**
 * Sanitizes and validates LLM parsed receipt output to guarantee strict data integrity
 */
export function sanitizeReceiptData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Hasil ekstraksi struk tidak valid.');
  }

  const cleanNum = (v, defaultVal = 0) => cleanIndonesianNumber(v, defaultVal);

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map((item, idx) => {
    const name = (item.name || `Item ${idx + 1}`).trim();
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    let pricePerUnit = cleanNum(item.price_per_unit);
    let totalPrice = cleanNum(item.total_price);

    if (totalPrice === 0 && pricePerUnit > 0) {
      totalPrice = pricePerUnit * qty;
    } else if (pricePerUnit === 0 && totalPrice > 0) {
      pricePerUnit = Math.round(totalPrice / qty);
    }

    return {
      id: item.id || `item_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      qty,
      price_per_unit: pricePerUnit,
      total_price: totalPrice
    };
  }).filter(i => i.total_price > 0 || i.name.length > 0);

  const itemsSum = items.reduce((s, i) => s + i.total_price, 0);
  let subtotal = cleanNum(raw.subtotal, itemsSum);
  if (subtotal === 0 && itemsSum > 0) subtotal = itemsSum;

  const tax = cleanNum(raw.tax);
  const serviceCharge = cleanNum(raw.service_charge);
  const discount = cleanNum(raw.discount);
  
  let grandTotal = cleanNum(raw.grand_total);
  const expectedGrand = subtotal + tax + serviceCharge - discount;
  if (grandTotal === 0 && expectedGrand > 0) {
    grandTotal = expectedGrand;
  }

  return {
    restaurant_name: (typeof raw.restaurant_name === 'string' && raw.restaurant_name.trim()) ? raw.restaurant_name.trim() : 'Restoran',
    subtotal,
    tax,
    service_charge: serviceCharge,
    discount,
    grand_total: grandTotal,
    items
  };
}
