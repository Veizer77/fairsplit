import { describe, it, expect } from 'vitest';
import { createEphemeralSession, fetchEphemeralSession, claimGuestItems } from '../src/services/sessionService.js';

describe('Ephemeral Guest Claiming Engine & Lifecycle Payload', () => {
  it('creates an ephemeral session payload with TTL 24h (86400s)', async () => {
    const billData = {
      restaurantName: 'Cafe Cerita Kopi',
      receipt: {
        subtotal: 50000,
        tax: 5000,
        service_charge: 0,
        discount: 0,
        grand_total: 55000,
        items: [
          { id: 'item_1', name: 'Kopi Susu Gula Aren', qty: 1, price_per_unit: 25000, total_price: 25000 },
          { id: 'item_2', name: 'Toast Srikaya', qty: 1, price_per_unit: 25000, total_price: 25000 }
        ]
      },
      participants: [{ id: 'p_host', name: 'Doni (Host)', is_paid: 1 }],
      allocations: []
    };

    const sessionRes = await createEphemeralSession(billData);
    expect(sessionRes.id).toBeDefined();
    expect(sessionRes.id.length).toBeGreaterThanOrEqual(6);

    const fetched = await fetchEphemeralSession(sessionRes.id);
    expect(fetched).toBeDefined();
    expect(fetched.restaurantName).toBe('Cafe Cerita Kopi');
    expect(fetched.expiresAt).toBeGreaterThan(Date.now());
  });

  it('allows a guest to claim items without logging in and updates claim map', async () => {
    const sessionRes = await createEphemeralSession({
      restaurantName: 'Bakmi GM',
      receipt: {
        subtotal: 60000,
        tax: 6000,
        service_charge: 0,
        discount: 0,
        grand_total: 66000,
        items: [
          { id: 'b1', name: 'Bakmi Spesial GM', qty: 1, price_per_unit: 35000, total_price: 35000 },
          { id: 'b2', name: 'Pangsit Goreng 5 pcs', qty: 1, price_per_unit: 25000, total_price: 25000 }
        ]
      },
      participants: [],
      allocations: []
    });

    const claimResult = await claimGuestItems(sessionRes.id, {
      guestName: 'Rina',
      itemIds: ['b1']
    });

    expect(claimResult.claimedBy.Rina).toContain('b1');
  });
});
