import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ReceiptScanner from './components/ReceiptScanner';
import ReceiptReview from './components/ReceiptReview';
import ParticipantManager from './components/ParticipantManager';
import ProportionalBreakdown from './components/ProportionalBreakdown';
import GuestClaimView from './components/GuestClaimView';
import ManualReceiptModal from './components/ManualReceiptModal';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import LatencyDashboard from './components/LatencyDashboard';
import { calculateFairSplit } from './services/proportionalEngine';
import { db } from './services/dbService';

const STORAGE_KEY_ACTIVE_STATE = 'fairsplit_active_state_v1';

const getSavedSessionState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function App() {
  const isGuestUrl = typeof window !== 'undefined' && /^\/b\/([a-zA-Z0-9_-]+)/.test(window.location.pathname);
  const savedState = !isGuestUrl ? getSavedSessionState() : null;

  const [step, setStep] = useState(() => {
    if (isGuestUrl) return 'GUEST_VIEW';
    if (savedState?.receipt && savedState?.step) {
      return savedState.step;
    }
    return 'SCAN';
  });

  const [receipt, setReceipt] = useState(() => {
    return savedState?.receipt || null;
  });

  const [participants, setParticipants] = useState(() => {
    return savedState?.participants || [
      { id: 'p_1', name: 'Saya (Host)', is_paid: 1 }
    ];
  });

  const [allocations, setAllocations] = useState(() => {
    return savedState?.allocations || [];
  });

  const [telemetry, setTelemetry] = useState(() => {
    return savedState?.telemetry || null;
  });

  const [rawOcrText, setRawOcrText] = useState(() => {
    return savedState?.rawOcrText || '';
  });

  const [guestSessionId, setGuestSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/b\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return null;
  });

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLatencyModalOpen, setIsLatencyModalOpen] = useState(false);
  const [hostSettings, setHostSettings] = useState(db.getSettings());
  const [toastMessage, setToastMessage] = useState(null);

  // Check URL routing for Guest Claim URL (/b/:id)
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/b\/([a-zA-Z0-9_-]+)/);
    if (match) {
      setGuestSessionId(match[1]);
      setStep('GUEST_VIEW');
    }
  }, []);

  // Persist active workflow across browser reloads
  useEffect(() => {
    if (step === 'GUEST_VIEW') return;
    if (!receipt) {
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_STATE);
      } catch {}
      return;
    }
    try {
      const stateToSave = {
        step,
        receipt,
        participants,
        allocations,
        telemetry,
        rawOcrText
      };
      localStorage.setItem(STORAGE_KEY_ACTIVE_STATE, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save active session state to localStorage:', e);
    }
  }, [step, receipt, participants, allocations, telemetry, rawOcrText]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleParsed = ({ receipt: parsedReceipt, rawText: text, telemetry: t }) => {
    setReceipt(parsedReceipt);
    setRawOcrText(text || '');
    setTelemetry(t);
    // Start with empty allocations so each member can claim their own items cleanly
    setAllocations([]);
    setStep('REVIEW');
  };

  const handleReset = () => {
    if (receipt && step !== 'SCAN') {
      const confirmReset = window.confirm('Mulai struk baru? Rincian saat ini akan direset.');
      if (!confirmReset) return;
    }
    setReceipt(null);
    setAllocations([]);
    setParticipants([{ id: 'p_1', name: 'Saya (Host)', is_paid: 1 }]);
    setTelemetry(null);
    setRawOcrText('');
    setStep('SCAN');
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_STATE);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl bg-slate-900 border border-brand-500/50 shadow-glow text-xs text-white max-w-sm">
          {toastMessage}
        </div>
      )}

      {/* Main Header */}
      {step !== 'GUEST_VIEW' && (
        <Header
          activeTab={step}
          setActiveTab={(tab) => setStep(tab === 'host' ? 'SCAN' : 'SCAN')}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenLatency={() => setIsLatencyModalOpen(true)}
          onReset={handleReset}
          latestLatency={telemetry}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {step === 'GUEST_VIEW' && (
          <GuestClaimView
            sessionId={guestSessionId}
            onBackToHost={() => {
              window.history.pushState({}, '', '/');
              setStep('SCAN');
            }}
          />
        )}

        {step === 'SCAN' && (
          <ReceiptScanner
            onParsed={handleParsed}
            onManualEntry={() => setIsManualModalOpen(true)}
            onError={(err) => showToast(err)}
            geminiApiKey={hostSettings.geminiApiKey}
            apiBase={hostSettings.customShareUrl}
          />
        )}

        {step === 'REVIEW' && receipt && (
          <ReceiptReview
            receipt={receipt}
            rawText={rawOcrText}
            onUpdateReceipt={(updated) => setReceipt(updated)}
            onConfirm={() => setStep('SPLIT')}
            onBack={() => setStep('SCAN')}
            telemetry={telemetry}
          />
        )}

        {step === 'SPLIT' && receipt && (
          <ParticipantManager
            receipt={receipt}
            participants={participants}
            allocations={allocations}
            onUpdateParticipants={setParticipants}
            onUpdateAllocations={setAllocations}
            onProceed={() => {
              // Save to local database
              db.saveReceipt({
                id: receipt.id || `rec_${Date.now()}`,
                ...receipt
              });
              setStep('SETTLE');
            }}
            onBack={() => setStep('REVIEW')}
          />
        )}

        {step === 'SETTLE' && receipt && (
          <ProportionalBreakdown
            calculation={calculateFairSplit({
              receipt,
              participants,
              allocations,
              roundingMode: hostSettings.defaultRounding || 'NEAREST'
            })}
            receipt={receipt}
            participants={participants}
            allocations={allocations}
            onUpdateParticipants={setParticipants}
            onBack={() => setStep('SPLIT')}
            hostSettings={hostSettings}
          />
        )}
      </main>

      {/* Modals */}
      <ManualReceiptModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={(data) => {
          setReceipt(data);
          setStep('REVIEW');
        }}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectReceipt={(r) => {
          setReceipt(r);
          setStep('REVIEW');
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaveSettings={(s) => setHostSettings(s)}
      />

      <LatencyDashboard
        isOpen={isLatencyModalOpen}
        onClose={() => setIsLatencyModalOpen(false)}
        telemetry={telemetry}
      />
    </div>
  );
}
