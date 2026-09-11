import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
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
  const navigate = useNavigate();
  const location = useLocation();
  const isGuestUrl = location.pathname.startsWith('/b/');
  const savedState = !isGuestUrl ? getSavedSessionState() : null;

  const [receipt, setReceipt] = useState(() => savedState?.receipt || null);
  const [participants, setParticipants] = useState(() => savedState?.participants || [{ id: 'p_1', name: 'Saya (Host)', is_paid: 1 }]);
  const [allocations, setAllocations] = useState(() => savedState?.allocations || []);
  const [telemetry, setTelemetry] = useState(() => savedState?.telemetry || null);
  const [rawOcrText, setRawOcrText] = useState(() => savedState?.rawOcrText || '');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLatencyModalOpen, setIsLatencyModalOpen] = useState(false);
  const [hostSettings, setHostSettings] = useState(db.getSettings());
  const [toastMessage, setToastMessage] = useState(null);

  // Persist active workflow across browser reloads
  useEffect(() => {
    if (isGuestUrl) return;
    if (!receipt) {
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_STATE);
      } catch {}
      return;
    }
    try {
      const stateToSave = {
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
  }, [receipt, participants, allocations, telemetry, rawOcrText, isGuestUrl]);

  // Route protection - if trying to access step without receipt
  useEffect(() => {
    if (!isGuestUrl && !receipt && location.pathname !== '/scan' && location.pathname !== '/') {
      navigate('/scan', { replace: true });
    }
  }, [receipt, location.pathname, isGuestUrl, navigate]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleParsed = ({ receipt: parsedReceipt, rawText: text, telemetry: t }) => {
    setReceipt(parsedReceipt);
    setRawOcrText(text || '');
    setTelemetry(t);
    setAllocations([]); // Start clean allocations
    navigate('/review');
  };

  const handleReset = () => {
    if (receipt && location.pathname !== '/scan') {
      const confirmReset = window.confirm('Mulai struk baru? Rincian saat ini akan direset.');
      if (!confirmReset) return;
    }
    setReceipt(null);
    setAllocations([]);
    setParticipants([{ id: 'p_1', name: 'Saya (Host)', is_paid: 1 }]);
    setTelemetry(null);
    setRawOcrText('');
    navigate('/scan');
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_STATE);
    } catch {}
  };

  // Convert current path to activeTab for Header
  let activeTab = 'SCAN';
  if (location.pathname === '/review') activeTab = 'REVIEW';
  if (location.pathname === '/split') activeTab = 'SPLIT';
  if (location.pathname === '/settle') activeTab = 'SETTLE';

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-slate-900/95 border border-rose-500/50 shadow-2xl text-xs text-white max-w-sm flex items-start gap-3 backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-300">Pemberitahuan</p>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header */}
      {!isGuestUrl && (
        <Header
          activeTab={activeTab}
          setActiveTab={() => navigate('/scan')}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenLatency={() => setIsLatencyModalOpen(true)}
          onReset={handleReset}
          latestLatency={telemetry}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 md:py-8 overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/scan" replace />} />
          
          <Route path="/b/:sessionId" element={<GuestClaimViewWrapper />} />

          <Route 
            path="/scan" 
            element={
              <ReceiptScanner
                onParsed={handleParsed}
                onManualEntry={() => setIsManualModalOpen(true)}
                onError={(err) => showToast(err)}
                geminiApiKey={hostSettings.geminiApiKey}
                apiBase={hostSettings.customShareUrl}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
              />
            } 
          />

          <Route 
            path="/review" 
            element={
              receipt ? (
                <ReceiptReview
                  receipt={receipt}
                  rawText={rawOcrText}
                  onUpdateReceipt={(updated) => setReceipt(updated)}
                  onConfirm={() => navigate('/split')}
                  onBack={() => navigate('/scan')}
                  telemetry={telemetry}
                />
              ) : <Navigate to="/scan" />
            } 
          />

          <Route 
            path="/split" 
            element={
              receipt ? (
                <ParticipantManager
                  receipt={receipt}
                  participants={participants}
                  allocations={allocations}
                  onUpdateParticipants={setParticipants}
                  onUpdateAllocations={setAllocations}
                  onProceed={() => {
                    db.saveReceipt({
                      id: receipt.id || `rec_${Date.now()}`,
                      ...receipt
                    });
                    navigate('/settle');
                  }}
                  onBack={() => navigate('/review')}
                />
              ) : <Navigate to="/scan" />
            } 
          />

          <Route 
            path="/settle" 
            element={
              receipt ? (
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
                  onBack={() => navigate('/split')}
                  hostSettings={hostSettings}
                />
              ) : <Navigate to="/scan" />
            } 
          />
        </Routes>
      </main>

      {/* Modals */}
      <ManualReceiptModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={(data) => {
          setReceipt(data);
          setAllocations([]);
          setParticipants([{ id: 'p_1', name: 'Saya (Host)', is_paid: 1 }]);
          setTelemetry({ source: 'MANUAL_ENTRY', totalMs: 0 });
          setRawOcrText('[Manual Entry]');
          navigate('/review');
        }}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelect={(savedData) => {
          setReceipt(savedData);
          setAllocations([]);
          setParticipants([{ id: 'p_1', name: 'Saya (Host)', is_paid: 1 }]);
          navigate('/review');
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={(newSettings) => {
          db.saveSettings(newSettings);
          setHostSettings(newSettings);
        }}
        currentSettings={hostSettings}
      />

      <LatencyDashboard
        isOpen={isLatencyModalOpen}
        onClose={() => setIsLatencyModalOpen(false)}
        telemetry={telemetry}
      />
    </div>
  );
}

// Wrapper for Guest Claim View to extract URL param
import { useParams } from 'react-router-dom';
function GuestClaimViewWrapper() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  return (
    <GuestClaimView
      sessionId={sessionId}
      onBackToHost={() => navigate('/scan')}
    />
  );
}
