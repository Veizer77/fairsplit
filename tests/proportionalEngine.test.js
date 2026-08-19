import { describe, it, expect } from 'vitest';
import { calculateFairSplit, ROUNDING_MODES, applyRounding } from '../src/services/proportionalEngine.js';

describe('Fair Allocation Engine & Mathematical Integrity', () => {
  const sampleReceipt = {
    restaurant_name: 'Resto Enak Nusantara',
    subtotal: 100000,
    tax: 10000,          // PB1 10%
    service_charge: 5000, // SC 5%
    discount: 15000,     // Promo Rp 15.000
    grand_total: 100000, // 100k + 10k + 5k - 15k = 100k
    items: [
      { id: 'i1', name: 'Nasi Goreng Spesial', qty: 1, price_per_unit: 40000, total_price: 40000 },
      { id: 'i2', name: 'Sate Ayam 10 Tusuk', qty: 1, price_per_unit: 35000, total_price: 35000 },
      { id: 'i3', name: 'Es Teh Manis', qty: 1, price_per_unit: 10000, total_price: 10000 },
      { id: 'i4', name: 'Tahu Tempe Goreng', qty: 1, price_per_unit: 15000, total_price: 15000 }
    ]
  };

  const participants = [
    { id: 'u1', name: 'Budi (Host)', is_paid: 1 },
    { id: 'u2', name: 'Siti', is_paid: 0 },
    { id: 'u3', name: 'Andi', is_paid: 0 }
  ];

  it('calculates exact proportional ratios according to PRD formula', () => {
    // Budi: Nasi Goreng (40k)
    // Siti: Sate Ayam (35k) + Es Teh (10k) = 45k
    // Andi: Tahu Tempe (15k)
    const allocations = [
      { item_id: 'i1', participant_id: 'u1', split_ratio: 1.0 },
      { item_id: 'i2', participant_id: 'u2', split_ratio: 1.0 },
      { item_id: 'i3', participant_id: 'u3', split_ratio: 0.0 }, // not Andi
      { item_id: 'i3', participant_id: 'u2', split_ratio: 1.0 }, // Siti gets Es Teh
      { item_id: 'i4', participant_id: 'u3', split_ratio: 1.0 }
    ];

    const result = calculateFairSplit({
      receipt: sampleReceipt,
      participants,
      allocations,
      roundingMode: ROUNDING_MODES.NEAREST
    });

    expect(result.isBalanced).toBe(true);
    expect(result.finalDeviation).toBe(0);

    const budi = result.breakdowns.find(b => b.name.includes('Budi'));
    const siti = result.breakdowns.find(b => b.name === 'Siti');
    const andi = result.breakdowns.find(b => b.name === 'Andi');

    // Budi ratio: 40,000 / 100,000 = 0.40
    expect(budi.ratio).toBeCloseTo(0.40);
    expect(budi.rawTax).toBeCloseTo(4000);
    expect(budi.rawService).toBeCloseTo(2000);
    expect(budi.rawDiscount).toBeCloseTo(6000);
    expect(budi.finalTotal).toBe(40000);

    // Siti ratio: 45,000 / 100,000 = 0.45
    expect(siti.ratio).toBeCloseTo(0.45);
    expect(siti.rawTax).toBeCloseTo(4500);
    expect(siti.rawService).toBeCloseTo(2250);
    expect(siti.rawDiscount).toBeCloseTo(6750);
    expect(siti.finalTotal).toBe(45000);

    // Andi ratio: 15,000 / 100,000 = 0.15
    expect(andi.ratio).toBeCloseTo(0.15);
    expect(andi.rawTax).toBeCloseTo(1500);
    expect(andi.rawService).toBeCloseTo(750);
    expect(andi.rawDiscount).toBeCloseTo(2250);
    expect(andi.finalTotal).toBe(15000);

    // Total must equal grand total
    const totalPayments = budi.finalTotal + siti.finalTotal + andi.finalTotal;
    expect(totalPayments).toBe(sampleReceipt.grand_total);
  });

  it('handles Penny Drift / Selisih Pembulatan and allocates delta to highest spender (Deviation = Rp 0)', () => {
    // Receipt with tricky odd numbers that cause fractional rounding drift
    const trickyReceipt = {
      restaurant_name: 'Warung Kopi Senja',
      subtotal: 100000,
      tax: 11000, // 11% PPN
      service_charge: 7000,
      discount: 0,
      grand_total: 118000,
      items: [
        { id: 't1', name: 'Espresso Single', qty: 1, price_per_unit: 33333, total_price: 33333 },
        { id: 't2', name: 'Latte Double', qty: 1, price_per_unit: 33333, total_price: 33333 },
        { id: 't3', name: 'Croissant Butter', qty: 1, price_per_unit: 33334, total_price: 33334 }
      ]
    };

    const pUsers = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Charlie' }
    ];

    const allocs = [
      { item_id: 't1', participant_id: 'a', split_ratio: 1.0 },
      { item_id: 't2', participant_id: 'b', split_ratio: 1.0 },
      { item_id: 't3', participant_id: 'c', split_ratio: 1.0 }
    ];

    const result = calculateFairSplit({
      receipt: trickyReceipt,
      participants: pUsers,
      allocations: allocs,
      roundingMode: ROUNDING_MODES.NEAREST
    });

    expect(result.finalDeviation).toBe(0);
    const sum = result.breakdowns.reduce((acc, curr) => acc + curr.finalTotal, 0);
    expect(sum).toBe(118000);
    expect(result.highestSpender).toBe('Charlie'); // 33334 > 33333
  });

  it('supports shared items split equally among multiple participants', () => {
    const sharedReceipt = {
      restaurant_name: 'Pizza Express',
      subtotal: 120000,
      tax: 12000,
      service_charge: 0,
      discount: 0,
      grand_total: 132000,
      items: [
        { id: 'pz1', name: 'Large Meat Lovers Pizza', qty: 1, price_per_unit: 120000, total_price: 120000 }
      ]
    };

    const users = [
      { id: 'u1', name: 'David' },
      { id: 'u2', name: 'Emma' },
      { id: 'u3', name: 'Frank' }
    ];

    // 1 Pizza shared equally (1/3 each)
    const allocs = [
      { item_id: 'pz1', participant_id: 'u1', split_ratio: 1 / 3 },
      { item_id: 'pz1', participant_id: 'u2', split_ratio: 1 / 3 },
      { item_id: 'pz1', participant_id: 'u3', split_ratio: 1 / 3 }
    ];

    const result = calculateFairSplit({
      receipt: sharedReceipt,
      participants: users,
      allocations: allocs
    });

    expect(result.finalDeviation).toBe(0);
    expect(result.breakdowns[0].finalTotal + result.breakdowns[1].finalTotal + result.breakdowns[2].finalTotal).toBe(132000);
    expect(result.breakdowns[0].finalTotal).toBe(44000);
    expect(result.breakdowns[1].finalTotal).toBe(44000);
    expect(result.breakdowns[2].finalTotal).toBe(44000);
  });

  it('supports custom rounding modes: FLOOR, STEP_100, STEP_500, STEP_1000', () => {
    expect(applyRounding(1234.56, ROUNDING_MODES.FLOOR)).toBe(1234);
    expect(applyRounding(1234.56, ROUNDING_MODES.CEIL)).toBe(1235);
    expect(applyRounding(1234.56, ROUNDING_MODES.STEP_100)).toBe(1200);
    expect(applyRounding(1280.00, ROUNDING_MODES.STEP_100)).toBe(1300);
    expect(applyRounding(1234.00, ROUNDING_MODES.STEP_500)).toBe(1000);
    expect(applyRounding(1350.00, ROUNDING_MODES.STEP_500)).toBe(1500);
    expect(applyRounding(1750.00, ROUNDING_MODES.STEP_1000)).toBe(2000);
  });

  it('detects subtotal mismatch when sum of item prices differs from receipt subtotal', () => {
    const mismatchReceipt = {
      restaurant_name: 'Mismatch Cafe',
      subtotal: 100000,
      tax: 10000,
      service_charge: 0,
      discount: 0,
      grand_total: 110000,
      items: [
        { id: 'm1', name: 'Item A', qty: 1, price_per_unit: 40000, total_price: 40000 },
        { id: 'm2', name: 'Item B', qty: 1, price_per_unit: 40000, total_price: 40000 }
        // sum is 80k, but subtotal declared 100k -> Mismatch of -20k
      ]
    };

    const result = calculateFairSplit({
      receipt: mismatchReceipt,
      participants: [{ id: 'u1', name: 'User 1' }],
      allocations: [{ item_id: 'm1', participant_id: 'u1', split_ratio: 1.0 }]
    });

    expect(result.hasSubtotalMismatch).toBe(true);
    expect(result.subtotalMismatchDiff).toBe(-20000);
  });

  it('correctly allocates multi-portion quantity split (e.g. 2x items claimed 1x by User A and 1x by User B)', () => {
    const multiQtyReceipt = {
      restaurant_name: 'Warung Nasi Bebek',
      subtotal: 100000,
      tax: 10000,
      service_charge: 0,
      discount: 0,
      grand_total: 110000,
      items: [
        { id: 'item_bebek', name: 'Bebek Crispy', qty: 2, price_per_unit: 50000, total_price: 100000 }
      ]
    };

    const multiParticipants = [
      { id: 'p_budi', name: 'Budi' },
      { id: 'p_tasha', name: 'Tasha' }
    ];

    // Budi claims 1 portion (ratio 0.5), Tasha claims 1 portion (ratio 0.5)
    const multiAllocs = [
      { item_id: 'item_bebek', participant_id: 'p_budi', split_ratio: 0.5, claimed_qty: 1 },
      { item_id: 'item_bebek', participant_id: 'p_tasha', split_ratio: 0.5, claimed_qty: 1 }
    ];

    const result = calculateFairSplit({
      receipt: multiQtyReceipt,
      participants: multiParticipants,
      allocations: multiAllocs
    });

    expect(result.isBalanced).toBe(true);
    expect(result.finalDeviation).toBe(0);

    const budi = result.breakdowns.find(b => b.name === 'Budi');
    const tasha = result.breakdowns.find(b => b.name === 'Tasha');

    expect(budi.subtotal).toBe(50000);
    expect(budi.finalTotal).toBe(55000);
    expect(tasha.subtotal).toBe(50000);
    expect(tasha.finalTotal).toBe(55000);
  });
});
