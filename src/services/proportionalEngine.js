/**
 * FairSplit - Fair Proportional Allocation Calculation Engine
 * 
 * Formula:
 * Rasio_u = Subtotal_u / Total_Subtotal
 * Pajak_u = Rasio_u * Total_Pajak
 * Service_u = Rasio_u * Total_Service
 * Diskon_u = Rasio_u * Total_Diskon
 * Total_Bayar_u = Subtotal_u + Pajak_u + Service_u - Diskon_u
 * 
 * Penny Drift / Rounding Resolution:
 * Deviasi = Grand_Total - Sum(Total_Bayar_u)
 * Allocated to the highest spender to achieve Mathematical Integrity (Deviation = Rp 0).
 */

export const ROUNDING_MODES = {
  NEAREST: 'NEAREST', // Math.round to integer
  FLOOR: 'FLOOR',     // Math.floor to integer
  CEIL: 'CEIL',       // Math.ceil to integer
  STEP_100: 'STEP_100', // Round to nearest Rp 100
  STEP_500: 'STEP_500', // Round to nearest Rp 500
  STEP_1000: 'STEP_1000' // Round to nearest Rp 1000
};

export function applyRounding(val, mode = ROUNDING_MODES.NEAREST) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  
  switch (mode) {
    case ROUNDING_MODES.FLOOR:
      return Math.floor(val);
    case ROUNDING_MODES.CEIL:
      return Math.ceil(val);
    case ROUNDING_MODES.STEP_100:
      return Math.round(val / 100) * 100;
    case ROUNDING_MODES.STEP_500:
      return Math.round(val / 500) * 500;
    case ROUNDING_MODES.STEP_1000:
      return Math.round(val / 1000) * 1000;
    case ROUNDING_MODES.NEAREST:
    default:
      return Math.round(val);
  }
}

/**
 * Calculates fair proportional bill split among participants
 * @param {Object} params
 * @param {Object} params.receipt - { subtotal, tax, service_charge, discount, grand_total, items }
 * @param {Array} params.participants - [{ id, name, is_paid }]
 * @param {Array} params.allocations - [{ item_id, participant_id, split_ratio }]
 * @param {string} params.roundingMode - Rounding strategy
 * @returns {Object} Full calculation result with breakdown and deviation report
 */
export function calculateFairSplit({
  receipt,
  participants = [],
  allocations = [],
  roundingMode = ROUNDING_MODES.NEAREST
}) {
  if (!receipt) {
    throw new Error('Receipt data is required');
  }

  const items = receipt.items || [];
  const tax = Number(receipt.tax) || 0;
  const serviceCharge = Number(receipt.service_charge) || 0;
  const discount = Number(receipt.discount) || 0;
  const grandTotal = Number(receipt.grand_total) || 0;

  // 1. Calculate sum of item totals to detect potential subtotal mismatches
  const itemsSum = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  const subtotalReceipt = Number(receipt.subtotal) || itemsSum;
  const hasSubtotalMismatch = Math.abs(itemsSum - subtotalReceipt) > 0.01;
  const subtotalMismatchDiff = itemsSum - subtotalReceipt;

  // 2. Track item allocation coverage
  const itemAllocationMap = {};
  items.forEach(item => {
    itemAllocationMap[item.id] = {
      item,
      allocatedRatio: 0,
      participantIds: []
    };
  });

  allocations.forEach(alloc => {
    if (itemAllocationMap[alloc.item_id]) {
      itemAllocationMap[alloc.item_id].allocatedRatio += Number(alloc.split_ratio) || 0;
      itemAllocationMap[alloc.item_id].participantIds.push(alloc.participant_id);
    }
  });

  const unallocatedItems = Object.values(itemAllocationMap).filter(
    info => info.allocatedRatio < 0.999
  );
  const unallocatedAmount = unallocatedItems.reduce(
    (sum, info) => sum + (info.item.total_price * (1 - info.allocatedRatio)),
    0
  );

  // 3. Calculate individual participant subtotal
  const userSubtotals = {};
  const userItemDetails = {};

  participants.forEach(p => {
    userSubtotals[p.id] = 0;
    userItemDetails[p.id] = [];
  });

  allocations.forEach(alloc => {
    const item = items.find(i => i.id === alloc.item_id);
    if (item && userSubtotals[alloc.participant_id] !== undefined) {
      const portion = (Number(item.total_price) || 0) * (Number(alloc.split_ratio) || 0);
      userSubtotals[alloc.participant_id] += portion;
      userItemDetails[alloc.participant_id].push({
        itemId: item.id,
        name: item.name,
        qty: item.qty,
        pricePerUnit: item.price_per_unit,
        totalItemPrice: item.total_price,
        splitRatio: alloc.split_ratio,
        portionPrice: portion
      });
    }
  });

  const totalAssignedSubtotal = Object.values(userSubtotals).reduce((a, b) => a + b, 0);

  // 4. Calculate proportional tax, service, discount per participant
  // Base subtotal for proportion calculation is the total assigned subtotal or receipt subtotal
  const baseSubtotal = totalAssignedSubtotal > 0 ? totalAssignedSubtotal : subtotalReceipt;

  const rawBreakdowns = participants.map(p => {
    const s_u = userSubtotals[p.id] || 0;
    const ratio_u = baseSubtotal > 0 ? (s_u / baseSubtotal) : 0;
    const tax_u = ratio_u * tax;
    const service_u = ratio_u * serviceCharge;
    const discount_u = ratio_u * discount;
    const rawTotal_u = s_u + tax_u + service_u - discount_u;

    const roundedSubtotal = applyRounding(s_u, roundingMode);
    const roundedTax = applyRounding(tax_u, roundingMode);
    const roundedService = applyRounding(service_u, roundingMode);
    const roundedDiscount = applyRounding(discount_u, roundingMode);
    const initialRoundedTotal = applyRounding(rawTotal_u, roundingMode);

    return {
      participantId: p.id,
      name: p.name,
      isPaid: !!p.is_paid,
      items: userItemDetails[p.id] || [],
      subtotal: s_u,
      rawSubtotal: s_u,
      ratio: ratio_u,
      rawTax: tax_u,
      rawService: service_u,
      rawDiscount: discount_u,
      rawTotal: rawTotal_u,
      roundedSubtotal,
      roundedTax,
      roundedService,
      roundedDiscount,
      initialRoundedTotal,
      finalTotal: initialRoundedTotal,
      roundingAdjustment: 0
    };
  });

  // 5. Penny Drift / Deviasi Resolution
  // Grand total target for participants (if items are unallocated, expected target is proportional to assigned subtotal)
  const expectedGrandTotal = unallocatedAmount > 0.01 && subtotalReceipt > 0
    ? applyRounding(grandTotal * (totalAssignedSubtotal / subtotalReceipt), roundingMode)
    : grandTotal;

  const sumInitialTotals = rawBreakdowns.reduce((sum, b) => sum + b.initialRoundedTotal, 0);
  const rawDeviation = expectedGrandTotal - sumInitialTotals;

  // Allocate deviation to participant with largest subtotal
  let highestSpenderIndex = -1;
  let maxSubtotal = -1;

  rawBreakdowns.forEach((b, idx) => {
    if (b.rawSubtotal > maxSubtotal) {
      maxSubtotal = b.rawSubtotal;
      highestSpenderIndex = idx;
    }
  });

  if (rawDeviation !== 0 && highestSpenderIndex !== -1 && participants.length > 0) {
    rawBreakdowns[highestSpenderIndex].finalTotal += rawDeviation;
    rawBreakdowns[highestSpenderIndex].roundingAdjustment = rawDeviation;
  }

  // 6. Verify final integrity
  const finalCalculatedSum = rawBreakdowns.reduce((sum, b) => sum + b.finalTotal, 0);
  const finalDeviation = expectedGrandTotal - finalCalculatedSum;

  return {
    restaurantName: receipt.restaurant_name || 'Restoran',
    subtotalReceipt,
    itemsSum,
    tax,
    serviceCharge,
    discount,
    grandTotal,
    expectedGrandTotal,
    roundingMode,
    totalAssignedSubtotal,
    unallocatedAmount,
    unallocatedItemsCount: unallocatedItems.length,
    hasSubtotalMismatch,
    subtotalMismatchDiff,
    breakdowns: rawBreakdowns,
    rawDeviation,
    finalDeviation,
    isBalanced: finalDeviation === 0,
    highestSpender: highestSpenderIndex >= 0 ? rawBreakdowns[highestSpenderIndex].name : null
  };
}
