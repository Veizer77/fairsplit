/**
 * Local-First Database & Settings Repository for FairSplit
 */

const STORAGE_KEYS = {
  RECEIPTS: 'fairsplit_receipts_v1',
  PARTICIPANTS: 'fairsplit_participants_v1',
  ALLOCATIONS: 'fairsplit_allocations_v1',
  SETTINGS: 'fairsplit_settings_v1'
};

export const DEFAULT_PAYMENT_METHODS = [
  {
    id: 'pm_default_1',
    type: 'BANK',
    provider: 'BCA',
    accountNumber: '1234567890',
    accountHolder: 'Nama Host',
    isPrimary: true
  },
  {
    id: 'pm_default_2',
    type: 'EWALLET',
    provider: 'GoPay',
    accountNumber: '081234567890',
    accountHolder: 'Nama Host',
    isPrimary: false
  }
];

export const POPULAR_PROVIDERS = [
  { name: 'BCA', type: 'BANK', icon: '🏦' },
  { name: 'Mandiri', type: 'BANK', icon: '🏦' },
  { name: 'BRI', type: 'BANK', icon: '🏦' },
  { name: 'BNI', type: 'BANK', icon: '🏦' },
  { name: 'Bank Jago', type: 'BANK', icon: '🏦' },
  { name: 'SeaBank', type: 'BANK', icon: '🏦' },
  { name: 'CIMB Niaga', type: 'BANK', icon: '🏦' },
  { name: 'Permata', type: 'BANK', icon: '🏦' },
  { name: 'GoPay', type: 'EWALLET', icon: '📱' },
  { name: 'OVO', type: 'EWALLET', icon: '📱' },
  { name: 'DANA', type: 'EWALLET', icon: '📱' },
  { name: 'ShopeePay', type: 'EWALLET', icon: '📱' },
  { name: 'QRIS All Payment', type: 'QRIS', icon: '🖼️' }
];

export const db = {
  // --- Receipts ---
  getAllReceipts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getReceiptById(id) {
    const list = this.getAllReceipts();
    return list.find(r => r.id === id) || null;
  },

  saveReceipt(receipt) {
    const list = this.getAllReceipts();
    const idx = list.findIndex(r => r.id === receipt.id);
    const updatedReceipt = {
      ...receipt,
      updated_at: Date.now()
    };
    if (idx >= 0) {
      list[idx] = updatedReceipt;
    } else {
      list.unshift(updatedReceipt);
    }
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(list));
    return updatedReceipt;
  },

  deleteReceipt(id) {
    const list = this.getAllReceipts().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(list));
  },

  // --- Settings ---
  getSettings() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (s) {
        const parsed = JSON.parse(s);
        // Ensure paymentMethods exists
        if (!parsed.paymentMethods || !Array.isArray(parsed.paymentMethods) || parsed.paymentMethods.length === 0) {
          parsed.paymentMethods = [
            {
              id: 'pm_legacy_1',
              type: 'BANK',
              provider: parsed.bankName || 'BCA',
              accountNumber: parsed.accountNumber || '1234567890',
              accountHolder: parsed.accountHolder || 'Nama Host',
              isPrimary: true
            }
          ];
          if (parsed.qrisImageUrl) {
            parsed.paymentMethods.push({
              id: 'pm_legacy_qris',
              type: 'QRIS',
              provider: 'QRIS Static',
              imageUrl: parsed.qrisImageUrl,
              isPrimary: false
            });
          }
        }
        return parsed;
      }
      
      return {
        hostName: 'Host',
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountHolder: 'Nama Host',
        qrisImageUrl: '',
        geminiApiKey: '',
        paymentMethods: DEFAULT_PAYMENT_METHODS,
        defaultRounding: 'NEAREST'
      };
    } catch {
      return {
        hostName: 'Host',
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountHolder: 'Nama Host',
        paymentMethods: DEFAULT_PAYMENT_METHODS
      };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
};
