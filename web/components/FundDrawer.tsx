"use client";

import { FundingPanel } from "./FundingPanel";

/** Deposit modal — wraps the cross-chain funding panel (chain select + CCTP / LI.FI). */
export function FundDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex between" style={{ padding: "16px 20px 0" }}>
          <span className="muted small mono">DEPOSIT</span>
          <button className="btn secondary" onClick={onClose} style={{ padding: "4px 12px" }}>✕</button>
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          <FundingPanel />
        </div>
      </div>
    </div>
  );
}
