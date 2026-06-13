"use client";

import { useFunding } from "@/app/providers";
import { FundingPanel } from "@/components/FundingPanel";
import { StrategyExplorer } from "@/components/StrategyExplorer";

export default function TradePage() {
  const { privyEnabled } = useFunding();

  return (
    <div style={{ paddingTop: 24 }}>
      <div className="grid cols-2">
        {privyEnabled ? (
          <FundingPanel />
        ) : (
          <div className="panel">
            <h2>Fund from anywhere</h2>
            <p className="sub">
              Any token, any chain → USDC on Derive. Powered by LI.FI + Privy,
              settled through the Arc USDC hub.
            </p>
            <div className="notice warn">
              Add <span className="mono">NEXT_PUBLIC_PRIVY_APP_ID</span> to enable
              wallet connect + the LI.FI funding funnel. The trade flow below works
              without it.
            </div>
          </div>
        )}

        <div className="panel">
          <h2>Why it&apos;s easy</h2>
          <p className="sub">Options, reframed for normal humans.</p>
          <ul className="muted small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li>
              <b>Cash-Secured Put</b> = &quot;deposit USDC, earn X% APR&quot;. Worst
              case you buy the asset cheaper.
            </li>
            <li><b>Covered Call</b> = extra yield on an asset you already hold.</li>
            <li><b>Buy Call</b> = leveraged upside, downside capped at the premium.</li>
            <li>Every strategy is single-leg and fully collateralised.</li>
          </ul>
          <p className="small" style={{ marginTop: 12 }}>
            New to options? <a href="/learn">Read the Learn guide →</a>
          </p>
        </div>
      </div>

      <div className="section-title">Pick a yield</div>
      <StrategyExplorer />
    </div>
  );
}
