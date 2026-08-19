import { describe, it, expect } from 'vitest';
import { GEMINI_SYSTEM_PROMPT, sanitizeGeminiOutput } from '../src/services/geminiVisionService.js';

describe('Google Gemini Multimodal Vision AI Service Layer', () => {
  it('conforms to the strict prompt contract with negative metadata exclusions', () => {
    expect(GEMINI_SYSTEM_PROMPT).toContain('restaurant_name');
    expect(GEMINI_SYSTEM_PROMPT).toContain('items');
    expect(GEMINI_SYSTEM_PROMPT).toContain('Dates & Timestamps');
    expect(GEMINI_SYSTEM_PROMPT).toContain('Payment method');
  });

  it('sanitizes and validates raw Gemini output into clean numbers and structured schema', () => {
    const mockRawGeminiResponse = {
      restaurant_name: 'Solaria Senayan City',
      subtotal: '120.000',
      service_charge: 0,
      tax: '12.000',
      discount: '10.000',
      grand_total: '122.000',
      items: [
        {
          name: 'Nasi Goreng Kambing',
          qty: 1,
          price_per_unit: '48.000',
          total_price: '48.000'
        },
        {
          name: 'Ayam Goreng Mentega',
          qty: 1,
          price_per_unit: '42.000',
          total_price: '42.000'
        },
        {
          name: 'Es Lemon Tea',
          qty: 2,
          price_per_unit: '15.000',
          total_price: '30.000'
        }
      ]
    };

    const sanitized = sanitizeGeminiOutput(mockRawGeminiResponse);

    expect(sanitized.restaurant_name).toBe('Solaria Senayan City');
    expect(sanitized.subtotal).toBe(120000);
    expect(sanitized.tax).toBe(12000);
    expect(sanitized.discount).toBe(10000);
    expect(sanitized.grand_total).toBe(122000);
    expect(sanitized.items.length).toBe(3);
    expect(sanitized.items[0].total_price).toBe(48000);
    expect(sanitized.items[2].total_price).toBe(30000);
  });

  it('handles missing subtotal and calculates fallback sum correctly', () => {
    const rawData = {
      restaurant_name: 'Bakmi GM',
      items: [
        { name: 'Bakmi Spesial GM', qty: 2, price_per_unit: 35000, total_price: 70000 },
        { name: 'Pangsit Goreng 5', qty: 1, price_per_unit: 20000, total_price: 20000 }
      ],
      tax: 9000
    };

    const sanitized = sanitizeGeminiOutput(rawData);
    expect(sanitized.subtotal).toBe(90000);
    expect(sanitized.grand_total).toBe(99000);
  });
});
