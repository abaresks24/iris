# Iris — Backend ↔ Frontend Coordination

Living coordination doc between two agents. **Update the section that's yours in every PR.**

- **claude1 — Backend** (Derive integration, maker, Arc settlement contract + API routes, env/secrets, deploy/CI). Works in an isolated git worktree `../iris-claude1` on `backend/*` branches.
- **claude2 — Frontend** (landing/3D, `/app` UI, components, UX). Works in the main checkout on `feat/*` / `front/*` branches.

---

## Workflow (agreed)

- **Branch** off `main`. Backend → `backend/<topic>`. Frontend → `feat/<topic>`.
- **PR into `main`**. Keep `main` always deployable — Vercel auto-deploys `main` on every push (build from root dir `web/`).
- **Small, focused PRs.** Update this file in your PR (Status + Asks).
- **Ownership (updated 2026-06-14 — claude1 now also does the `/app` UI):**
  - **claude1:** `web/lib/api.ts` + `web/lib/arc/**` + `web/lib/derive/**` + `web/app/api/**` + `web/.env.local`/Vercel env; **the `/app` experience**: `web/app/app/**` + the app components (`EarnExplorer`, `DepositModal`, `PositionsPanel`, `HistoryPanel`, `PremiumPanel`, `Ambiance`, `IrisBloom`, `CountUp`, `AppNav`).
  - **claude2:** the **landing**: `web/app/page.tsx` + `web/components/landing/**` + landing assets.
  - **`web/app/globals.css` = SHARED design tokens.** ⚠️ Both edit it — coordinate. The palette is the single source of truth for app + landing, so changes ripple to both. Flag any token change here.
  - claude2: import API shapes from `web/lib/api.ts`, don't redefine them.
- **🌐 The whole site must be in ENGLISH** (user requirement). The `/app` is fully English. **claude2: make sure the landing (copy, buttons, labels) is English too** — no French strings.
- Live URL: **https://iris-finance.vercel.app** · Repo (public): https://github.com/abaresks24/iris

---

## Architecture (so the front knows what's real)

Hybrid: **Derive does the matching off-chain** (order signing, orderbook, a maker account auto-fills) — real fills. **Our own `DeriveSettlement` contract on Circle Arc does the settlement on-chain** (Derive's testnet on-chain settlement reverts in a dead price feed). So after a fill, the backend books it on Arc → a real settlement tx that succeeds.

- `DeriveSettlement` (Arc testnet, chain 5042002): `0xB01cfE8dA5e46c6c4754d196E90De1f93308d0f8`
- Arc explorer: https://testnet.arcscan.app · RPC: https://rpc.testnet.arc.network
- Derive env: `demo` (api-demo.lyra.finance). Main account subaccount **144326**; maker subaccount **144328** (auto-fills user orders).

---

## API contract (the interface claude2 builds against)

All routes are Next API handlers under `web/app/api/*`, called via the typed client in `web/lib/api.ts` (`import { api } from "@/lib/api"`). Base is relative (`/api`), no env needed.

| Method | Path | Input | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, env, restUrl, tradingEnabled, subaccountId }` |
| GET | `/api/presets` | — | `{ presets: PresetMeta[] }` |
| GET | `/api/strategies/[preset]` | `?currency=ETH&amount=1` | `StrategyCandidates { preset, currency, indexPrice, expiry, daysToExpiry, candidates: Economics[] }` |
| GET | `/api/ticker/[instrument]` | — | Derive ticker (mark, greeks, iv, best bid/ask) |
| GET | `/api/instruments` | `?currency=ETH` | live option instruments |
| POST | `/api/trade` | `{ preset, instrumentName, amount, trader? }` | `{ economics, order, submitted, makerOrder, filled, arcSettlement }` |
| GET | `/api/account` | — | Derive subaccount (NOTE: `positions` is usually empty — settlement reverts on Derive testnet; use Arc positions instead) |
| GET | `/api/history` | — | Derive trade history (real fills show here) |
| GET | `/api/arc/positions` | `?trader=0x..` (required) | `{ contract, explorer, positions: ArcPosition[] }` — **the real on-chain portfolio** |

`PresetId = "cash_secured_put" | "covered_call" | "long_call"`.
Types `Economics`, `PresetMeta`, `StrategyCandidates`, `ArcSettlement`, `ArcPosition` are exported from `web/lib/api.ts`.

**`/api/trade` response, key fields for the UI:**
- `filled: boolean` — true when the maker crossed the order (instant fill).
- `arcSettlement: { txHash, explorerUrl, contract, chainId } | { error }` — the on-chain Arc settlement. Show `explorerUrl` as the "settled on-chain" proof (it's the money-shot for the demo).

**Portfolio:** drive it from `api.arcPositions(connectedWallet)` — those are the real on-chain positions. `api.account()` positions stay empty by design.

---

## Backend status — claude1

**Done & stable (front can rely on it):**
- Self-contained Next API backend (no separate Express server in prod).
- Derive matching + maker auto-fill verified live (cross-account, no self-trade block).
- Arc `DeriveSettlement` deployed + wired; `/api/trade` books fills on-chain, `/api/arc/positions` reads them. Verified end-to-end on the live URL.
- Git → Vercel auto-deploy working (push `main` → build → live).

**In progress / next:** (none committed yet)

**Changelog:**
- 2026-06-14 — **Real per-user money flow** for Cash-Secured Put. New OptionVault on Arc collateralised by a **mintable test USDC** (`MockUSDC 0xE392…028f`, `OptionVault 0x0cD8…497E`, markets ETH/BTC/SOL). CSP now executes from the user's wallet: switch to Arc → `/api/gas` drips native gas (Arc gas = native USDC, 18-dec) → mint test USDC → approve → `openCashSecuredPut` (locks collateral, pays premium). Covered-call/buy-call still use the Derive mirror. `/api/positions` merges real vault positions + mirror fills; Dashboard/Premium/Activity read it. Added `arcTestnet` to wagmi + Privy. **Verified on-chain**: collateral locked + premium paid + gas faucet send.
- 2026-06-14 — Token SVG logos (`TokenIcon`, ETH/BTC/SOL) replace letter chips; **mobile-responsive** (nav wraps, grids stack, tables scroll, `prefers-reduced-motion` + fireflies off on phone); **removed Points** (nav + page + panel). **Dashboard/Premium/Activity are now per-connected-wallet** (sourced from `api.arcPositions(wallet)` with a connect-gate) — no more the shared Derive account's 200k collateral / global history. `/api/account` + `/api/history` are no longer used by the UI (they return the shared maker account, not the user).
- 2026-06-14 — Rysk type system + earn-table UX; **live orderbook sim bot** (`web/scripts/marketBot.mjs`, `npm run bot --prefix web`) posts/cancels jittered bids on the maker account so APRs move in real time; EarnExplorer now polls every 6s; `useCountUp` tweens from the previous value; robust fill detection (user order can cross bot liquidity directly); removed the "Live from Derive" badge; **whole site must be English** (app already is — see ⚠️ below for the landing).
- 2026-06-14 — `/app` reskin: **"iris dans le sous-bois"** forest DA (PR `app/forest-iris-da`). Kept Rysk layout. **globals.css palette changed** (forest-understory canvas `#08140E`, mossy surfaces, new `--color-gold` = iris beard amber, sage text, spectrum now includes gold). New shared CSS classes: `.ambiance` (canopy fog + fireflies), `.shimmer` (spectral sweep on hero numbers), `.live-dot`, `.reveal` (staggered rise-in), `.iris-bloom` (fill moment). New components: `Ambiance`, `IrisBloom`, `CountUp` + `lib/useCountUp`. All CSS-driven, no new deps, honours `prefers-reduced-motion`.
- 2026-06-14 — Hybrid Derive-matching + Arc-settlement shipped; maker account; CI/CD via GitHub→Vercel; repo public.

**⚠️ Heads-up for claude2 (palette + FONTS changed):**
- `globals.css` palette tokens → forest sous-bois + `--color-gold`.
- **Type system switched to Rysk's:** `web/app/layout.tsx` now loads **DM Sans** (body), **DM Mono** (numbers), **Bodoni Moda** (display serif) via `next/font` — Geist + Syne removed. The CSS vars `--font-sans` / `--font-mono` / `--font-display` now resolve to these. Big headings (`.display`, `.h1`, `.landing-title`, `.title-serif`) are serif; everything else DM Sans; numbers DM Mono.
- When you `git rebase main` into `feat/landing-3d`, expect conflicts in `globals.css` **and** `web/app/layout.tsx` — keep the new forest tokens + the Rysk fonts (shared source of truth), re-apply your landing rules on top. The landing title currently uses `.landing-title` → now Bodoni serif; if you want a different display face for the hero, override locally and tell me. New utility classes (`.ambiance`, `.shimmer`, `.live-dot`, `.reveal`, `.iris-bloom`, `.asset-chip`, `.apr-range`, `.btn.sm`) are reusable on the landing.

---

## Frontend status — claude2

**Done (PR `feat/landing-3d`):**
- New **scroll-driven 3D landing** (`web/app/page.tsx` → `web/components/landing/ForestExperience.tsx`). React Three Fiber (`three` 0.171 / `@react-three/fiber` 9 / `@react-three/drei` 10). User arrives at the start of a forest dirt road; scrolling walks the camera down the path; the Iris logo + plain-English option explainers reveal alongside; **Docs / Learn / Launch app** CTAs land at the end.
- Source GLB **128 MB → 11 MB** (Draco + WebP @768). Heavy source kept local (`Front/` now gitignored). Optimised asset at `web/public/iris-forest.glb`; backdrop `web/public/forest-bg.png`.
- Camera path **auto-detected** (road meshes + terrain raycast) → no hardcoded waypoints. Tuning via `/?debug` and `/?preview=<0..1>`; constants atop `ForestExperience.tsx`.
- `tsc` clean, `next build` OK (route `/` prerendered static, +~150 kB three.js on `/` only).

**Updated (merged to `main`):**
- Camera now follows the **real winding path** (snake centerline over the road meshes), daylight lighting, tangent-look. Direction confirmed with the user (entrance → fields).
- **10 educational bubbles**, now **STICKY** (each pinned center-screen for a ~100vh hold so the user can read while the path keeps advancing), **alternating left/right**, styled in the **rysk.finance DA** (Bodoni Moda titles, DM Sans body, DM Mono labels, charcoal `#1e2222` cards, cream text, yellow `#FFD049` accent).
- **Landing is now ENGLISH** (per the site-wide requirement). Removed the growing-iris SVG.
- Merged `origin/main`: landing now consumes the **shared Rysk fonts + forest tokens** (dropped my duplicate `--font-rysk-*`; bubbles use `--font-display`/`--font-sans`/`--font-mono`). Deleted the **old video landing** (`page.tsx` already replaced; removed dead `.landing*`/`.hero-*` CSS + `public/hero.mp4`).

**Blocked:** nothing.

---

## Asks — claude1 → claude2 (what I need from the front)

1. In the trade flow, keep passing the **connected Privy wallet** as `trader` to `api.trade(...)` (already wired in `DepositModal.tsx`). The Arc settlement + portfolio are keyed on it.
2. Build the portfolio view off **`api.arcPositions(wallet)`**, not `api.account()` positions.
3. Surface the **Arc settlement explorer link** from the trade response (`arcSettlement.explorerUrl`) — it's the on-chain proof for the jury.
4. Don't hardcode any RPC/contract addresses or API base in the front — read what you need from the API responses.

## Asks — claude2 → claude1 (what the front needs from me)

1. 🔴 **CRITICAL — `max_fee` too low rejects every SELL-premium trade via the Derive path.**
   - **Scope (re-tested 2026-06-14, same instrument/amount):**
     - **Hero Cash-Secured Put (Arc OptionVault path)** → ✅ **WORKS E2E** — verified headless from a throwaway wallet (`web/test-csp-vault.mjs`): `/api/gas` drip → `quoteCashSecuredPut` (collateral 1800, premium 139.4 USDC) → mint → approve → `openCashSecuredPut` **status success** (`0xe2fe4ca446c512fa3dd140ae7508792bda103fb2b070b1b1a57520d0c4dbe1da`), position lands on-chain + shows in `/api/positions` (`real:true`). The vault path is solid.
     - `long_call` (**Buy Call**, Derive path) → ✅ **200, `filled:true`, real Arc settlement** (`0x6ae90ae8fba05d5056dff889ca84629d4452a9ccfe0a877c1035efd5db8119c8`).
     - `covered_call` (Derive path) → ❌ **400** `Max fee order param is too low … >= 16.34`. **This is now the ONLY broken trade flow** (CSP uses the vault, Buy Call's max_fee happens to clear the floor; only the sell-call mirror underprices `max_fee`).
   - **Symptom:** `POST /api/trade` → 400 `Derive API error on /private/order: {code:11023, "Signed max_fee must be >= 16.339460643418324"}`. Threshold ~16.34, ~constant across amounts 0.1/1/5. Auth + EIP-712 signing + submission all succeed — only the signed `max_fee` is under Derive's floor for the sell-premium presets.
   - **Root cause:** `web/lib/derive/strategy.ts:163-164`
     ```js
     const estFee = num(ticker.base_fee) + num(ticker.taker_fee_rate) * notional;
     const maxFee = Math.max(estFee * 3, 1);   // floor of 1 is far below Derive's ~16.34 minimum
     ```
   - **Suggested fix:** raise the floor above Derive's per-order minimum, e.g. `Math.max(estFee * 3, 25)` (or derive it from the ticker's real fee fields if exposed). Then place one live CSP to confirm `filled:true` + `arcSettlement.txHash`.
   - **Repro:** `curl -s -X POST localhost:3000/api/trade -H 'content-type: application/json' -d '{"preset":"cash_secured_put","instrumentName":"ETH-20260703-1800-P","amount":1,"trader":"0x183a4CE28b96F60f3e66be2F6DdCc85474880B36"}'`
   - Found during a full smoke test (2026-06-14, claude2). Everything else passed — see log.

2. ❓ **Positioning question from the user — "we should only MATCH existing Derive orders, never PLACE our own."** Current behaviour isn't that: on the Derive path the **user posts an order** and **our maker account posts the opposite side** to fill it (self-provided liquidity, because the demo testnet book is empty); and the **hero CSP doesn't touch Derive orders at all** (it's the on-chain Arc vault). "Only-match-never-place" is feasible on mainnet (real liquidity) but not on the dead testnet. Your call on the framing — flag if you want to change the model or just adjust the pitch wording.

3. ❓ **Chainlink vs Derive pricing (user asked).** Heads-up so the pitch stays accurate: in `OptionVault.sol` the **CSP premium is priced from a protocol-set `aprBps`, not from Derive** (`_premium()`), and Chainlink is the **settlement/spot oracle** (`_spot()` / `settle()`). So for the hero CSP, Derive supplies the *displayed* price + strike menu, but execution is a self-contained on-chain protocol (premium = aprBps, payoff = Chainlink). Chainlink is genuinely needed (off-chain Derive prices can't settle on-chain) — just don't claim "Derive prices the option" for the vault path.

4. 🎨 **Heads-up — I retuned the SHARED palette + number font** (user asked: "less AI, purple too vivid, fix the number font"). In `globals.css`: `--color-accent` `#9D5BFF`→**`#7C6FB8`** (muted iris violet), spectrum indigo/violet/magenta muted to match, and **numbers switched from DM Mono → DM Sans tabular** (`.numeric`, `.card .apr`, `.kpi .v`, `.hero-num`, `.apr-range`; `.mono` and uppercase labels stay DM Mono). This ripples to the `/app` too — ping me if any of your number styles look off and I'll adjust.

---

## Open log (dated, newest first)

- **2026-06-14 (claude2):** Design retune on user request — muted the iris violet (`--color-accent` → `#7C6FB8`) + spectrum, numbers DM Mono → DM Sans tabular ("less AI" look). Flagged 3 things to claude1 (asks #2–4): the only-match-vs-place positioning, the Chainlink-vs-Derive pricing nuance (CSP premium = `aprBps`, not Derive), and the shared-token change.

- **2026-06-14 (claude2):** Ran a full smoke test (local + live). **PASS:** all pages 200; live deploy serves the new 3D landing; `/api/health|presets|instruments(394 ETH opts)|strategies(real candidates)|arc/positions` all good; `/app/earn` renders. **FAIL (critical):** `POST /api/trade` rejected by Derive — `max_fee` below the ~16.34 minimum for every amount → see **ask #1 to claude1** (one-line fix in `lib/derive/strategy.ts`). Not editing it (claude1 owns `lib/derive/**`).
- **2026-06-14 (claude2):** Landing **merged into `main`** (path-following camera, sticky alternating Rysk-styled bubbles, English copy). Merged `origin/main` first — adopted the shared Rysk fonts + forest palette, deleted the old video landing (`.landing*`/`.hero-*` CSS + `hero.mp4`). `tsc` + `next build` green. Owns only `page.tsx` + `components/landing/**`; `globals.css` edits are confined to the `.fl-*` landing block.
- **2026-06-14 (claude2):** 3D forest-path landing shipped (PR `feat/landing-3d` → #3). Replaces the static video hero. Only touches frontend-owned files (`page.tsx`, `globals.css`, `web/components/**`, new `web/public/*` assets) + `package.json`/lock for three/R3F/drei — nothing in `lib/api.ts`, `app/api/**`, or `server/`. No backend asks yet.
- **2026-06-14 (claude1):** Created this doc + the worktree workflow. Backend stable; awaiting frontend asks. PR: `backend/coordination`.
