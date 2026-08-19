import { describe, it, expect } from 'vitest';
import { sanitizeReceiptData, GROQ_SCHEMA, GROQ_SYSTEM_PROMPT } from '../src/services/groqService.js';

describe('Groq Prompt Contract & Schema Validation Layer', () => {
  it('conforms to the prompt contract defined in PRD Section 4.1', () => {
    expect(GROQ_SCHEMA.restaurant_name).toBeDefined();
    expect(GROQ_SCHEMA.subtotal).toBe('number');
    expect(GROQ_SCHEMA.service_charge).toBe('number');
    expect(GROQ_SCHEMA.tax).toBe('number');
    expect(GROQ_SCHEMA.discount).toBe('number');
    expect(GROQ_SCHEMA.grand_total).toBe('number');
    expect(Array.isArray(GROQ_SCHEMA.items)).toBe(true);
    expect(GROQ_SYSTEM_PROMPT).toContain('restaurant_name');
    expect(GROQ_SYSTEM_PROMPT).toContain('JSON');
  });

  it('sanitizes and coerces raw LLM output into clean numbers and structured schema', () => {
    const rawLlmMock = {
      restaurant_name: '  Sederhana Bintaro  ',
      subtotal: 'Rp 150.000',
      tax: '15.000',
      service_charge: '0',
      discount: null,
      grand_total: '165000',
      items: [
        { name: 'Rendang Sapi', qty: '2', price_per_unit: '30.000', total_price: '60000' },
        { name: 'Ayam Pop', qty: 1, price_per_unit: 25000, total_price: 25000 },
        { name: 'Gulai Kepala Kakap', qty: '1', price_per_unit: 65000, total_price: null } // computed
      ]
    };

    const sanitized = sanitizeReceiptData(rawLlmMock);

    expect(sanitized.restaurant_name).toBe('Sederhana Bintaro');
    expect(sanitized.subtotal).toBe(150000);
    expect(sanitized.tax).toBe(15000);
    expect(sanitized.service_charge).toBe(0);
    expect(sanitized.discount).toBe(0);
    expect(sanitized.grand_total).toBe(165000);
    expect(sanitized.items.length).toBe(3);

    expect(sanitized.items[0].qty).toBe(2);
    expect(sanitized.items[0].total_price).toBe(60000);

    // Gulai Kepala Kakap total_price was null, should be inferred from price * qty
    expect(sanitized.items[2].total_price).toBe(65000);
  });

  it('rejects invalid or empty objects safely without crashing', () => {
    expect(() => sanitizeReceiptData(null)).toThrow();
    expect(() => sanitizeReceiptData(undefined)).toThrow();

    const emptyResult = sanitizeReceiptData({});
    expect(emptyResult.restaurant_name).toBe('Restoran');
    expect(emptyResult.subtotal).toBe(0);
    expect(emptyResult.items).toEqual([]);
  });
});
