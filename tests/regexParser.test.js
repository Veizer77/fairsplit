import { describe, it, expect } from 'vitest';
import { parseReceiptWithRegex } from '../src/services/regexParserService.js';

describe('Smart Deterministic Heuristic Parser for Indonesian Receipts', () => {
  const sampleOcrText = `
BEBEK BENGIL BALI
Jl. Hanoman, Ubud, Bali
Table: 12  Cashier: Wayan

1 Bebek Bengil Crispy     135.000
2 Nasi Putih               20.000
2 Ice Lemon Tea            50.000
1 Sambal Matah Extra       15.000

Subtotal                  220.000
Service Charge 5%          11.000
PB1 / Tax 10%              22.000
Diskon Promo Member       -20.000
Grand Total               233.000

Thank you for visiting!
`;

  it('successfully extracts restaurant name, items, tax, service, discount offline', () => {
    const result = parseReceiptWithRegex(sampleOcrText);

    expect(result.source).toBe('OFFLINE_REGEX');
    expect(result.data.restaurant_name).toBe('BEBEK BENGIL BALI');
    expect(result.data.subtotal).toBe(220000);
    expect(result.data.service_charge).toBe(11000);
    expect(result.data.tax).toBe(22000);
    expect(result.data.discount).toBe(20000);
    expect(result.data.grand_total).toBe(233000);
    expect(result.data.items.length).toBeGreaterThanOrEqual(3);

    const bebek = result.data.items.find(i => i.name.toLowerCase().includes('bebek'));
    expect(bebek).toBeDefined();
    expect(bebek.total_price).toBe(135000);
  });

  it('robustly ignores dates, times, phone numbers, table numbers, cashier, and cash/kembalian lines', () => {
    const noisyReceipt = `
WARUNG KOPI NIKMAT
Jl. Kaliurang KM 5 No. 12, Yogyakarta
Telp: (0274) 889123  NPWP: 01.234.567.8
19/08/2026 14:35:20  Bill #881293
Meja: 04  Pax: 2  Kasir: Hendra

2 Kopi Susu Gula Aren      36.000
1 Pisang Goreng Keju       20.000
1 Roti Bakar Coklat        25.000

Subtotal                   81.000
PB1 10%                     8.100
Grand Total                89.100

Tunai                     100.000
Kembali                    10.900
Terima Kasih Atas Kunjungan Anda
WiFi Password: senjapagi123
`;

    const result = parseReceiptWithRegex(noisyReceipt);

    expect(result.data.restaurant_name).toBe('WARUNG KOPI NIKMAT');
    expect(result.data.subtotal).toBe(81000);
    expect(result.data.tax).toBe(8100);
    expect(result.data.grand_total).toBe(89100);

    // Ensure metadata is NOT in items
    const itemNames = result.data.items.map(i => i.name.toLowerCase());
    expect(itemNames.some(n => n.includes('19/08/2026'))).toBe(false);
    expect(itemNames.some(n => n.includes('14:35'))).toBe(false);
    expect(itemNames.some(n => n.includes('meja'))).toBe(false);
    expect(itemNames.some(n => n.includes('kasir'))).toBe(false);
    expect(itemNames.some(n => n.includes('tunai'))).toBe(false);
    expect(itemNames.some(n => n.includes('kembali'))).toBe(false);
    expect(itemNames.some(n => n.includes('wifi'))).toBe(false);

    // Verify correct items are parsed
    expect(result.data.items.length).toBe(3);
    const kopi = result.data.items.find(i => i.name.toLowerCase().includes('kopi'));
    expect(kopi).toBeDefined();
    expect(kopi.qty).toBe(2);
    expect(kopi.total_price).toBe(36000);
  });

  it('correctly reconstructs multi-line wrapped items', () => {
    const multiLineReceipt = `
SOLARIA RESTAURANT
Plaza Senayan Lt. 3

Nasi Goreng Kambing Spesial
1x 48.000
Ayam Goreng Mentega
1x 42.000
Es Lemon Tea
2x 30.000

Subtotal                  120.000
PB1 10%                    12.000
Grand Total               132.000
`;

    const result = parseReceiptWithRegex(multiLineReceipt);
    expect(result.data.items.length).toBe(3);
    expect(result.data.items[0].name).toContain('Nasi Goreng Kambing');
    expect(result.data.items[0].total_price).toBe(48000);
    expect(result.data.items[1].name).toContain('Ayam Goreng Mentega');
    expect(result.data.items[1].total_price).toBe(42000);
    expect(result.data.items[2].name).toContain('Es Lemon Tea');
    expect(result.data.items[2].total_price).toBe(30000);
  });

  it('throws a friendly error when OCR text is empty', () => {
    expect(() => parseReceiptWithRegex('')).toThrow('Teks struk kosong.');
    expect(() => parseReceiptWithRegex('   ')).toThrow('Teks struk kosong.');
  });
});
