# Iris

> *Options, anywhere.* — named for Iris, the rainbow goddess who bridges worlds.

A simple, cross-chain front-end on top of **[Derive](https://derive.xyz)**'s
permissionless options orderbook (ex-Lyra). Deposit any token from any chain →
it lands as USDC on Derive Chain → run a **fully-collateralised, single-leg**
options strategy presented as a plain-English yield product.

> Built solo at **ETHGlobal NYC** (June 2026). We ride Derive's existing
> liquidity and users (no cold-start) and add the onboarding + UX layer.

## Architecture — hybrid matching + settlement

Derive does the **matching** off-chain (order signing, orderbook, a maker that
auto-fills) — that all works. But Derive's *testnet* on-chain settlement reverts
inside an unmaintained price feed, so positions can't finalise there. We
reproduce the one broken piece — **settlement** — in our own
[`DeriveSettlement`](contracts/src/DeriveSettlement.sol) contract on **Circle
Arc** (Chainlink feeds live), where the settlement tx succeeds.

```
user order → signed + matched on Derive (real fill) → backend records the fill
in DeriveSettlement.record() on Arc → real settlement tx (status 1)
```

- **Live:** https://web-ochre-rho-41.vercel.app  (auto-deployed from `main`)
- **DeriveSettlement (Arc testnet, chain 5042002):** `0xB01cfE8dA5e46c6c4754d196E90De1f93308d0f8`

---

## Why this exists

Options are powerful but scary. We reframe a single, fully-collateralised leg as
a retail product:

| Preset | What the user sees | Under the hood |
| --- | --- | --- |
| **Cash-Secured Put** ⭐ | "Deposit USDC, earn X% APR. Worst case you buy the asset cheaper." | Sell a put, collateralised by USDC |
| **Covered Call** | "Earn extra yield on an asset you hold." | Sell a call, collateralised by the underlying |
| **Buy Call** | "Bet on upside, downside capped at the premium." | Buy a call |

All three are the *same* primitive — one option, fully collateralised, **zero
margin maths, zero liquidations**. The cross-chain funnel is USDC-centric, which
is exactly what a cash-secured put needs → the **Cash-Secured Put is the hero**.

## Architecture

```
                 ┌──────────────────────── web (Next.js 15) ───────────────────────┐
  any chain ──▶  │  Privy (wallet + embedded)   LI.FI (bridge→USDC)   Arc (USDC hub) │
  any token      │                         ↓ funds                                   │
                 │  StrategyExplorer ── reads market ──▶  ┌────────────────────────┐ │
                 │  TradeModal       ── place order  ──▶  │  server (Node/TS)       │ │
                 └────────────────────────────────────────│  Derive REST client     │─┘
                                                           │  EIP-712 order signing  │
                                                           │  (session key)          │
                                                           └──────────┬──────────────┘
                                                                      ▼
                                                   Derive orderbook  (api-demo.lyra.finance)
```

- **No custom Solidity.** We integrate Derive's existing contracts + bridges.
- **`server/`** holds the session key and signs every order (EIP-712), so the
  owner key never leaves the user. Mirrors the official
  [`v2-action-signing`](https://github.com/derivexyz/v2-action-signing-python) SDK.
- **`web/`** is the cross-chain onboarding + the retail strategy UI.

### Sponsor tracks (no overlapping layers)

- **Privy** — wallet + embedded wallets + universal funding (the *wallet* layer).
- **LI.FI Composer** — one-tx bridge+swap into USDC (the *execution* layer).
- **Arc** — chain-abstracted USDC settlement hub (the *asset* layer).

Privy and Dynamic are competing wallet layers, so we deliberately picked **one**
(Privy) and paired it with LI.FI + Arc, which sit on different layers.

---

## Quickstart

```bash
# 1. install
npm run install:all          # installs server + web

# 2. backend (read-only works out of the box against Derive testnet)
cp server/.env.example server/.env
npm run dev:server           # → http://localhost:8799

# 3. frontend
cp web/.env.example web/.env.local
npm run dev:web              # → http://localhost:3000
```

The app is **fully functional read-only immediately**: it streams live ETH/BTC
options from Derive's demo orderbook and computes real APRs. To place real
orders and connect wallets, fill in the env files (below).

### Backend env (`server/.env`)

| var | purpose |
| --- | --- |
| `DERIVE_ENV` | `demo` (testnet, default) or `prod` (mainnet) |
| `DERIVE_OWNER_ADDRESS` | your Derive smart-contract wallet address |
| `DERIVE_SUBACCOUNT_ID` | the subaccount you trade from |
| `DERIVE_SESSION_PRIVATE_KEY` | a throwaway session key (`npm run signkey --prefix server`) |

Until these are set, the server runs **read-only** (no orders). See
[`docs/ONBOARDING.md`](docs/ONBOARDING.md) for the one-time Derive account setup.

### Frontend env (`web/.env.local`)

| var | purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | backend URL (default `http://localhost:8799`) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | from [dashboard.privy.io](https://dashboard.privy.io) — enables connect + funding |
| `NEXT_PUBLIC_LIFI_API_KEY` | optional, higher LI.FI rate limits |

Without `NEXT_PUBLIC_PRIVY_APP_ID` the funding panel is disabled but the **trade
flow still works** (served by the backend session key).

---

## API (backend)

| method | route | description |
| --- | --- | --- |
| GET | `/api/health` | env + whether trading is configured |
| GET | `/api/presets` | the three strategy presets |
| GET | `/api/strategies/:preset?currency=ETH&amount=1` | live candidates + computed APR/economics |
| GET | `/api/instruments?currency=ETH` | raw option instruments |
| GET | `/api/ticker/:instrument` | live ticker (greeks, IV, book) |
| POST | `/api/trade` | sign (EIP-712) + place an order |
| GET | `/api/account` | subaccount collateral + positions + open orders |

---

## Demo script (≈90s)

1. **"Options, for normal people."** Open the app — live ETH cash-secured puts,
   each shown as an APR.
2. **Fund from anywhere.** Connect with Privy, pick "100 USDC from Arbitrum",
   get a real LI.FI route → USDC heading to Derive Chain.
3. **Earn.** Click a card → "Earn X% APR" → the order is EIP-712 signed by the
   session key and hits Derive's **live orderbook**.
4. **Position shows up** under "Your positions on Derive". Real, on-chain.

---

## What's verified vs. pending

- ✅ Live market reads + APR computation against `api-demo.lyra.finance`.
- ✅ EIP-712 order signing — signature recovers to the session key; encoding is a
  1:1 port of the official SDK.
- ✅ Next.js build + full UI render (with graceful no-key fallbacks).
- ⏳ End-to-end order acceptance needs a funded testnet account + a registered
  session key (one-time onboarding — see `docs/ONBOARDING.md`).
- ⏳ Mainnet (`prod`) constants must be filled from docs.derive.xyz Protocol
  Constants before flipping `DERIVE_ENV=prod` (the code throws a clear error
  until then).
