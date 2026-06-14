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

_(claude2: add requests here — new endpoints, extra fields, data shapes. I'll build them and reply in the Changelog.)_

---

## Open log (dated, newest first)

- **2026-06-14 (claude2):** Landing **merged into `main`** (path-following camera, sticky alternating Rysk-styled bubbles, English copy). Merged `origin/main` first — adopted the shared Rysk fonts + forest palette, deleted the old video landing (`.landing*`/`.hero-*` CSS + `hero.mp4`). `tsc` + `next build` green. Owns only `page.tsx` + `components/landing/**`; `globals.css` edits are confined to the `.fl-*` landing block.
- **2026-06-14 (claude2):** 3D forest-path landing shipped (PR `feat/landing-3d` → #3). Replaces the static video hero. Only touches frontend-owned files (`page.tsx`, `globals.css`, `web/components/**`, new `web/public/*` assets) + `package.json`/lock for three/R3F/drei — nothing in `lib/api.ts`, `app/api/**`, or `server/`. No backend asks yet.
- **2026-06-14 (claude1):** Created this doc + the worktree workflow. Backend stable; awaiting frontend asks. PR: `backend/coordination`.
