import type { Metadata } from "next";
import { PageTopbar } from "@/components/PageTopbar";

export const metadata: Metadata = {
  title: "Iris — Docs",
  description: "How Iris works: architecture, order flow, signing, API and security.",
};

const TOC = [
  ["overview", "Overview"],
  ["architecture", "Architecture"],
  ["flow", "End-to-end flow"],
  ["signing", "Order signing (EIP-712)"],
  ["strategies", "Strategies & economics"],
  ["security", "Security model"],
  ["api", "Backend API"],
  ["onboarding", "Onboarding (testnet)"],
  ["funding", "Cross-chain funding"],
  ["roadmap", "Demo vs. product"],
];

export default function Docs() {
  return (
    <>
      <PageTopbar active="docs" />
      <div className="doc-layout">
        <aside className="doc-toc">
          <span className="toc-title">On this page</span>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </aside>

        <article className="prose">
          <h1>Iris documentation</h1>
          <p className="lede">
            Iris is a cross-chain front-end on top of Derive&apos;s permissionless
            options orderbook. It owns no contracts and no liquidity — it adds the
            onboarding, the retail UX, and the signing layer that turns a click
            into a valid order on Derive.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            Derive (ex-Lyra) runs a permissionless, hybrid options orderbook: the
            matching is fast and off-chain, settlement is non-custodial and
            on-chain on Derive Chain (an OP-Stack L2). Anyone with a Derive
            account can read the market and submit signed orders — there is no
            market-maker whitelist.
          </p>
          <p>
            Iris rides that liquidity and reframes it for normal users: deposit
            any token from any chain, and run a <strong>single-leg, fully
            collateralised</strong> options strategy presented as a plain-English
            yield product (&quot;deposit USDC, earn X% APR&quot;).
          </p>

          <h2 id="architecture">Architecture</h2>
          <pre>
            <code>{`  any token / any chain
        │  LI.FI (swap + bridge)
        ▼
  USDC on Derive Chain ── deposit ──▶ Subaccount (collateral + positions)
        ▲                                   ▲
        │ Privy embedded wallet             │ signed orders (EIP-712)
        │                                   │
  ┌─────┴───────────── Iris web (Next.js) ──┴──────────┐
  │  funding UI · strategy cards (APR) · trade · portfolio │
  └───────────────────────┬────────────────────────────┘
                          │ REST
              ┌───────────▼────────────┐
              │  Iris server (Node/TS)  │  holds the session key,
              │  Derive client + signer │  signs every order
              └───────────┬────────────┘
                          ▼
              Derive REST/WS  (api.lyra.finance)`}</code>
          </pre>
          <table>
            <thead>
              <tr>
                <th>Layer</th>
                <th>Owned by Derive</th>
                <th>Owned by Iris</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Liquidity / orderbook</td>
                <td>✓</td>
                <td></td>
              </tr>
              <tr>
                <td>Smart wallets, subaccounts, session keys</td>
                <td>✓</td>
                <td></td>
              </tr>
              <tr>
                <td>Matching + on-chain settlement</td>
                <td>✓</td>
                <td></td>
              </tr>
              <tr>
                <td>Cross-chain onboarding (Privy · LI.FI · Arc)</td>
                <td></td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Retail framing (options → APR)</td>
                <td></td>
                <td>✓</td>
              </tr>
              <tr>
                <td>Order signer (EIP-712)</td>
                <td></td>
                <td>✓</td>
              </tr>
            </tbody>
          </table>

          <h2 id="flow">End-to-end flow</h2>
          <h3>1 · Fund</h3>
          <p>
            The user holds some token on some chain. LI.FI quotes a route that
            swaps + bridges it into USDC heading to Derive Chain (in one
            transaction). The USDC lands in the user&apos;s Derive smart wallet and
            is deposited into a subaccount as collateral.
          </p>
          <h3>2 · Discover</h3>
          <p>
            The Iris backend reads Derive&apos;s public endpoints
            (<code>get_instruments</code>, <code>get_ticker</code>) for live
            options — prices, greeks, implied volatility, top-of-book. The
            strategy layer turns each option into an economics object: premium,
            collateral, breakeven, and an annualised yield.
          </p>
          <h3>3 · Trade</h3>
          <p>
            The user clicks a card (&quot;Earn 72% APR&quot;). The backend builds
            the trade, signs it with a session key (EIP-712), and submits it to
            Derive&apos;s matching engine. The order crosses the live book; the
            position settles on-chain and shows up in the subaccount.
          </p>

          <h2 id="signing">Order signing (EIP-712)</h2>
          <p>
            Every order is a signed authorization. Iris ports the official Derive
            scheme (<code>derivexyz/v2-action-signing</code>) 1:1. The steps:
          </p>
          <pre>
            <code>{`1. ABI-encode the trade module data
   [asset, subId, limitPrice·1e18, amount·1e18, maxFee·1e18, recipientId, isBid]
2. moduleDataHash = keccak(encoded)
3. actionHash = keccak( abi.encode(
     ACTION_TYPEHASH, subaccountId, nonce, tradeModule,
     moduleDataHash, signatureExpiry, owner, signer) )
4. digest = keccak( 0x1901 ‖ DOMAIN_SEPARATOR ‖ actionHash )
5. signature = sign(digest, sessionKey)   // 65 bytes
6. POST /private/order { ...order, signer, signature, nonce }`}</code>
          </pre>
          <p>
            The matching engine recovers the signature, checks the signer is a
            registered session key for that subaccount, and matches. The{" "}
            <code>nonce</code> (timestamp + random) prevents replay; the{" "}
            <code>DOMAIN_SEPARATOR</code> binds the signature to the right chain
            and contracts.
          </p>

          <h2 id="strategies">Strategies & economics</h2>
          <p>
            All three presets are the same primitive — one option, fully
            collateralised. They differ only in option type, direction, and
            collateral.
          </p>
          <table>
            <thead>
              <tr>
                <th>Preset</th>
                <th>Action</th>
                <th>Collateral</th>
                <th>Framed as</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cash-Secured Put</td>
                <td>sell a put</td>
                <td>USDC (strike × size)</td>
                <td>&quot;deposit USDC, earn APR&quot;</td>
              </tr>
              <tr>
                <td>Covered Call</td>
                <td>sell a call</td>
                <td>the underlying</td>
                <td>&quot;yield on an asset you hold&quot;</td>
              </tr>
              <tr>
                <td>Buy Call</td>
                <td>buy a call</td>
                <td>premium paid</td>
                <td>&quot;capped-risk upside bet&quot;</td>
              </tr>
            </tbody>
          </table>
          <p>The yield framing for the income presets:</p>
          <pre>
            <code>{`periodReturn = premium / collateral
APR          = (premium / collateral) × (365 / daysToExpiry) × 100`}</code>
          </pre>

          <h2 id="security">Security model</h2>
          <pre>
            <code>{`EOA (you) ──owner──▶ Smart Wallet ──holds──▶ Subaccount (funds + positions)
   │ signs only onboarding                         ▲
   Session key (Iris backend) ──signs orders───────┘
       └─ CANNOT withdraw to an arbitrary address`}</code>
          </pre>
          <p>
            Iris holds only the session key. Even a fully compromised backend can
            place trades inside the subaccount but <strong>cannot move funds
            out</strong> — withdrawals require the owner key, which never leaves
            the user.
          </p>
          <div className="callout">
            <span className="tag">Why no liquidations</span>
            Single-leg fully collateralised means the maximum obligation is
            pre-funded (e.g. a cash-secured put locks the full strike in USDC). No
            margin, no liquidation, no risk maths — which is exactly what lets us
            present it as a simple yield product.
          </div>

          <h2 id="api">Backend API</h2>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Route</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>GET</td><td><code>/api/health</code></td><td>env + trading status</td></tr>
              <tr><td>GET</td><td><code>/api/presets</code></td><td>the strategy presets</td></tr>
              <tr><td>GET</td><td><code>/api/strategies/:preset</code></td><td>live candidates + APR</td></tr>
              <tr><td>GET</td><td><code>/api/instruments</code></td><td>raw option instruments</td></tr>
              <tr><td>GET</td><td><code>/api/ticker/:instrument</code></td><td>live ticker + greeks</td></tr>
              <tr><td>POST</td><td><code>/api/trade</code></td><td>sign + place an order</td></tr>
              <tr><td>GET</td><td><code>/api/account</code></td><td>collateral + positions</td></tr>
              <tr><td>GET</td><td><code>/api/history</code></td><td>trade history</td></tr>
            </tbody>
          </table>

          <h2 id="onboarding">Onboarding (testnet)</h2>
          <p>
            The demo trades on Derive testnet (<code>api-demo.lyra.finance</code>,
            chain id 901) — no real money. One-time setup:
          </p>
          <ol>
            <li>Generate a session key (<code>npm run signkey</code>).</li>
            <li>
              Connect at <code>testnet.derive.xyz</code>; get gas from{" "}
              <code>l2faucet.com/derive</code>.
            </li>
            <li>
              Get test USDC through the app&apos;s deposit flow (the test-USDC
              <code>mint()</code> is gated to Derive&apos;s bridge).
            </li>
            <li>Create a subaccount + deposit; note the subaccount id.</li>
            <li>Register the session-key address on the Developers page.</li>
            <li>
              Fill <code>server/.env</code> and the backend signs + submits real
              testnet orders.
            </li>
          </ol>

          <h2 id="funding">Cross-chain funding</h2>
          <p>
            Three layers, no overlap: <strong>Privy</strong> (wallet + embedded
            wallets), <strong>LI.FI</strong> (swap+bridge into USDC, one tx), and{" "}
            <strong>Arc</strong> (USDC settlement hub). Privy and other
            wallet-infra providers are mutually exclusive — Iris commits to Privy
            and pairs it with LI.FI and Arc, which sit on different layers.
          </p>

          <h2 id="roadmap">Demo vs. product</h2>
          <p>
            <strong>Demo:</strong> the backend trades from one pre-onboarded
            account via a session key — viewers do nothing on Derive.{" "}
            <strong>Product:</strong> the onboarding (smart wallet + subaccount +
            session key) is automatable behind Privy, so a real user goes
            connect → deposit → earn without ever leaving Iris. That automation is
            the main demo-to-product gap.
          </p>
        </article>
      </div>
    </>
  );
}
