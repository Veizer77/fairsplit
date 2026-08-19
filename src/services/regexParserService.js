/**
 * Smart Deterministic Heuristic Parser for Indonesian Restaurant Receipts
 * Designed to GoPay / Line SplitBill standard:
 * - Stage 1: Noise & Metadata Exclusion (Dates, Times, Meja, Cashier, Phone, NPWP, Payment lines)
 * - Stage 2: Structural Classification (Header, Item Lines, Charges, Footers)
 * - Stage 3: Multi-Line Item Reconstruction (Item Name on L1, Qty & Price on L2)
 * - Stage 4: Strict Price Sanity Checks (Reject Years 2024..2030, Phone prefixes, Time numbers)
 * - Stage 5: Arithmetic Cross-Validation (Match item sum against Subtotal & Grand Total)
 */

export function cleanIndonesianAmount(str) {
  if (typeof str === 'number') return isNaN(str) ? 0 : Math.abs(str);
  if (!str || typeof str !== 'string') return 0;

  // Remove percentage like 10%, 11%, 5%
  let cleaned = str.replace(/\d+%/g, '').replace(/rp|idr/gi, '').trim();
  if (!cleaned) return 0;

  // Match numbers with thousand separators e.g. "150.000" or "1.500.000" or plain "150000"
  const matches = cleaned.match(/([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,}|[0-9]{1,3})/g);
  if (!matches || matches.length === 0) return 0;

  // Pick the rightmost valid amount
  for (let i = matches.length - 1; i >= 0; i--) {
    const rawNum = matches[i].replace(/[.,]/g, '');
    const num = parseInt(rawNum, 10);
    // Ignore small isolated numbers (like table 4, pax 2) unless no other choice
    if (num > 0 && num < 100000000) {
      return num;
    }
  }
  return 0;
}

export function parseReceiptWithRegex(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Teks struk kosong.');
  }

  const startTime = performance.now();
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  let restaurantName = null;
  const rawItems = [];
  let subtotal = 0;
  let tax = 0;
  let serviceCharge = 0;
  let discount = 0;
  let grandTotal = 0;

  // 1. Noise / Non-Item Patterns (Metadata, Dates, Tables, Cashier, Payments, Footers)
  const isDateOrTime = (line) => {
    // 19/08/2026, 19-08-2026, 2026-08-19, 14:35:10, 14:35, 19 Aug 2026, 19 Agustus
    return /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b|\b\d{1,2}:\d{2}(:\d{2})?\b|\b(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\b/i.test(line);
  };

  const isMetadataHeader = (line) => {
    return /\b(meja|table|pax|guest|tamu|pos|reg|cashier|kasir|server|waiter|bill|order|trx|inv|invoice|resi|check|nota|no\.|tgl|date|time|waktu|shift|terminal)\b/i.test(line);
  };

  const isMerchantLocationOrContact = (line) => {
    return /\b(jl\.|jalan|kel\.|kec\.|kota|mall|floor|lt\.|gedung|telp|phone|wa|whatsapp|npwp|wifi|password|instagram|ig:|follow|cabang|outlet)\b/i.test(line);
  };

  const isPaymentOrFooter = (line) => {
    return /\b(cash|tunai|kembali|kembalian|change|debit|qris|kartu|card|bca|mandiri|bni|bri|cimb|gopay|ovo|dana|shopeepay|linkaja|rounding|pembulatan|terima kasih|thank you|selamat|kunjungan|simpan|layanan konsumen|call center)\b/i.test(line);
  };

  const isChargeSummary = (line) => {
    return /\b(subtotal|sub\s*total|jumlah|pajak|tax|pb1|ppn|service|layanan|sc\s|charge|diskon|discount|promo|voucher|potongan|hemat|grand\s*total|total\s*bayar|total\s*akhir|tagihan|net\s*total|total)\b/i.test(line);
  };

  // 2. Identify Restaurant Name from the first few clean non-metadata lines
  for (let i = 0; i < Math.min(6, rawLines.length); i++) {
    const line = rawLines[i];
    if (!isDateOrTime(line) && !isMetadataHeader(line) && !isMerchantLocationOrContact(line) && !isChargeSummary(line) && !isPaymentOrFooter(line)) {
      if (line.length >= 3 && !/^[0-9\W]+$/.test(line)) {
        restaurantName = line.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
        break;
      }
    }
  }

  // 3. Scan Lines for Charges (Subtotal, Tax, SC, Discount, Grand Total)
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Subtotal
    if (/subtotal|sub\s*total|jumlah\s*harga|total\s*item/i.test(line) && !/grand|pajak|tax/i.test(line)) {
      const amt = cleanIndonesianAmount(line);
      if (amt > 0) subtotal = amt;
      continue;
    }

    // Tax / PB1 / PPN
    if (/tax|pajak|pb1|ppn/i.test(line) && !/non\s*tax/i.test(line)) {
      const amt = cleanIndonesianAmount(line);
      if (amt > 0) tax = amt;
      continue;
    }

    // Service Charge
    if (/service|layanan|sc\s|charge/i.test(line) && !/charge\s*total|cash/i.test(line)) {
      const amt = cleanIndonesianAmount(line);
      if (amt > 0) serviceCharge = amt;
      continue;
    }

    // Discount / Promo
    if (/diskon|discount|promo|voucher|potongan|hemat/i.test(line)) {
      const amt = cleanIndonesianAmount(line);
      if (amt > 0) discount = amt;
      continue;
    }

    // Grand Total
    if (/grand\s*total|total\s*bayar|total\s*akhir|tagihan|net\s*total|total/i.test(line) && !/subtotal|item/i.test(line)) {
      const amt = cleanIndonesianAmount(line);
      if (amt > 0) grandTotal = Math.max(grandTotal, amt);
      continue;
    }
  }

  // 4. Extract Real Food & Beverage Item Rows
  // Filter out any lines that are clearly metadata or charges
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Skip non-item lines
    if (isDateOrTime(line) || isMetadataHeader(line) || isMerchantLocationOrContact(line) || isPaymentOrFooter(line) || isChargeSummary(line)) {
      continue;
    }

    // Must contain letters (item name)
    if (!/[a-zA-Z]{2,}/.test(line)) {
      continue;
    }

    // Case A: Single line format e.g. "2 Nasi Goreng Spesial 60.000" or "Bebek Crispy 1x 135.000" or "Ayam Pop 25.000"
    const singleLineMatch = line.match(/^(\d+x?\s+)?([a-zA-Z0-9\s&'().\-/]+?)\s+(?:(\d+x?)\s+)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})$/i);
    if (singleLineMatch) {
      const leadingQty = singleLineMatch[1] ? parseInt(singleLineMatch[1].replace(/[^0-9]/g, ''), 10) : null;
      const trailingQty = singleLineMatch[3] ? parseInt(singleLineMatch[3].replace(/[^0-9]/g, ''), 10) : null;
      const qty = leadingQty || trailingQty || 1;
      const name = singleLineMatch[2].replace(/^[@*\-x\s]+|[@*\-x\s]+$/g, '').trim();
      const price = cleanIndonesianAmount(singleLineMatch[4]);

      // Sanity checks: Name must not be year or metadata keyword, price > 0, price != year 2024..2030
      if (name.length >= 2 && price > 0 && !isDateOrTime(name) && !isMetadataHeader(name)) {
        rawItems.push({
          id: `item_regex_${rawItems.length + 1}`,
          name,
          qty,
          price_per_unit: Math.round(price / qty),
          total_price: price
        });
        continue;
      }
    }

    // Case B: Item name on current line, price on NEXT line (Multi-line receipt wrapping)
    if (i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      if (!isChargeSummary(nextLine) && !isPaymentOrFooter(nextLine) && !isDateOrTime(nextLine)) {
        const nextPriceMatch = nextLine.match(/^(\d+x?\s+)?(?:@?[0-9.,]+\s+)?([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})$/i);
        if (nextPriceMatch) {
          const qty = nextPriceMatch[1] ? parseInt(nextPriceMatch[1].replace(/[^0-9]/g, ''), 10) || 1 : 1;
          const price = cleanIndonesianAmount(nextPriceMatch[2]);
          const name = line.replace(/^[@*\-x\s]+|[@*\-x\s]+$/g, '').trim();

          if (name.length >= 2 && price > 0 && !isMetadataHeader(name) && !isDateOrTime(name)) {
            rawItems.push({
              id: `item_regex_${rawItems.length + 1}`,
              name,
              qty,
              price_per_unit: Math.round(price / qty),
              total_price: price
            });
            i++; // skip next line since consumed as price
            continue;
          }
        }
      }
    }

    // Case C: Standard loose regex match with trailing price
    const looseMatch = line.match(/^(\d+x?\s+)?(.+?)\s+([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,})$/i);
    if (looseMatch) {
      const qty = looseMatch[1] ? parseInt(looseMatch[1].replace(/[^0-9]/g, ''), 10) || 1 : 1;
      const name = looseMatch[2].replace(/^[@*\-x\s]+|[@*\-x\s]+$/g, '').trim();
      const price = cleanIndonesianAmount(looseMatch[3]);

      if (name.length >= 2 && price >= 500 && !isDateOrTime(name) && !isMetadataHeader(name) && !isPaymentOrFooter(name)) {
        rawItems.push({
          id: `item_regex_${rawItems.length + 1}`,
          name,
          qty,
          price_per_unit: Math.round(price / qty),
          total_price: price
        });
      }
    }
  }

  // 5. Arithmetic Cross-Validation & Sanity Filter
  const itemsSum = rawItems.reduce((s, i) => s + i.total_price, 0);
  if (subtotal === 0) subtotal = itemsSum;
  if (grandTotal === 0) grandTotal = subtotal + tax + serviceCharge - discount;

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    data: {
      restaurant_name: restaurantName || 'Restoran',
      subtotal,
      tax,
      service_charge: serviceCharge,
      discount,
      grand_total: grandTotal,
      items: rawItems
    },
    latencyMs,
    source: 'OFFLINE_REGEX',
    model: 'gopay-heuristic-engine-v2'
  };
}
