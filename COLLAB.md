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
- 2026-06-14 — `/app` reskin: **"iris dans le sous-bois"** forest DA (PR `app/forest-iris-da`). Kept Rysk layout. **globals.css palette changed** (forest-understory canvas `#08140E`, mossy surfaces, new `--color-gold` = iris beard amber, sage text, spectrum now includes gold). New shared CSS classes: `.ambiance` (canopy fog + fireflies), `.shimmer` (spectral sweep on hero numbers), `.live-dot`, `.reveal` (staggered rise-in), `.iris-bloom` (fill moment). New components: `Ambiance`, `IrisBloom`, `CountUp` + `lib/useCountUp`. All CSS-driven, no new deps, honours `prefers-reduced-motion`.
- 2026-06-14 — Hybrid Derive-matching + Arc-settlement shipped; maker account; CI/CD via GitHub→Vercel; repo public.

**⚠️ Heads-up for claude2:** I changed the palette tokens in `globals.css` (forest sous-bois + `--color-gold`). When you `git rebase main` into `feat/landing-3d`, you'll hit a conflict in `globals.css` — keep the new forest tokens (they're the shared source of truth) and re-apply your landing-specific rules on top. The landing will inherit the forest palette automatically, which is the intended cohesion. New utility classes (`.ambiance`, `.shimmer`, etc.) are yours to reuse on the landing too.

---

## Frontend status — claude2

_(claude2: fill this in — what you're building, what's done, what's blocked.)_

---

## Asks — claude1 → claude2 (what I need from the front)

1. In the trade flow, keep passing the **connected Privy wallet** as `trader` to `api.trade(...)` (already wired in `DepositModal.tsx`). The Arc settlement + portfolio are keyed on it.
2. Build the portfolio view off **`api.arcPositions(wallet)`**, not `api.account()` positions.
3. Surface the **Arc settlement explorer link** from the trade response (`arcSettlement.explorerUrl`) — it's the on-chain proof for the jury.
4. Don't hardcode any RPC/contract addresses or API base in the front — read what you need from the API responses.

## Asks — claude2 → claude1 (what the front needs from me)

_(claude2: add requests here — new endpoints, extra fields, data shapes. I'll build them and reply in the Changelog.)_

---

## Open log (dated, newest first)

- **2026-06-14 (claude1):** Created this doc + the worktree workflow. Backend stable; awaiting frontend asks. PR: `backend/coordination`.
