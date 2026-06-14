# Iris — handoff (protocol live on Arc, front is yours)

The options protocol is **deployed, funded and verified on-chain on Arc testnet**,
and the frontend SDK + chain wiring are done. You only build the UI.

## Deployed (Arc testnet, chainId 5042002)
| Contract | Address |
| --- | --- |
| **OptionVault** | `0x79B66d067e669a8Cd68eA68300d7B55110CD7449` |
| ETH/USD feed (mock, settable) | `0x81C445E289687efD51EAbc5ffD8a0B84c63C471d` |
| WETH (test, public mint) | `0xCbCa2596d3C5986AD90f29Fc449b7F11a00CA528` |
| USDC (Arc native, 6-dec) | `0x3600000000000000000000000000000000000000` |

- Treasury funded with **50 USDC** (premiums are paid from here).
- ETH market live (`marketId 0`, 15% APR premium param).
- ✅ Verified on-chain: quote + a real `openCashSecuredPut` (position #0 recorded).
- Explorer: https://testnet.arcscan.app

## What's wired (`web/lib/protocol/`)
- `arc.ts` — Arc chain def, addresses, CCTP constants, read client.
- `optionVaultAbi.ts` / `erc20Abi.ts` — ABIs.
- `vault.ts` — read/write SDK (quotes, positions, balances, open/settle, WETH faucet).
- `useIris.ts` — **drop-in React hook** wrapping the SDK + connected wallet.
- `app/providers.tsx` — Arc added to wagmi + Privy (default chain).

## How your front uses it
```tsx
"use client";
import { useIris } from "@/lib/protocol/useIris";

function Earn() {
  const iris = useIris();
  // read
  const spot = await iris.getSpotUsd();                       // ETH/USD
  const q = await iris.quotePut(2800, 1, expirySec);          // { collateral, premium, aprPct }
  const positions = await iris.getPositions();                // user's positions
  const bal = await iris.getBalances();                       // { usdc, weth }
  // write (needs connected wallet)
  await iris.openPut(2800, 1, expirySec);                     // approve + open, returns tx hash
  await iris.openCall(3200, 1, expirySec);
  await iris.mintTestWeth(5);                                 // test WETH faucet
}
```
`expirySec` = unix seconds in the future (e.g. `Math.floor(Date.now()/1000)+30*86400`).

## To test live
1. Get USDC on Arc from the **Circle faucet** (https://faucet.circle.com → Arc testnet) — it's gas + collateral.
2. Connect (Privy / wallet) on Arc.
3. `openPut(...)` → position shows via `getPositions()`.

## Still open (next, not blocking the core)
- **Repoint the existing Earn/Dashboard UI** (currently still calls the old Derive backend in `lib/api.ts`) to `useIris`. ← the main "front" task.
- **LI.FI Composer + CCTP funding** ("deposit from any chain → Arc"): CCTP V2 addresses are in `arc.ts` (`CCTP`, Arc domain 26). Flow to build: source-chain Composer Flow `swap → approve TokenMessengerV2 → depositForBurn(domain 26)`; CCTP mints USDC on Arc. Targets the LI.FI + Circle tracks.
- **Live Chainlink feed**: swap the mock `ethUsdFeed` for the real Arc feed address when wiring (vault reads any `AggregatorV3Interface`).

## Sponsor tracks
- **Circle/Arc** ✅ — protocol deployed on Arc, USDC collateral, CCTP for cross-chain USDC (Arc = liquidity hub).
- **Privy** ✅ — embedded wallets + Arc default chain (add universal deposit addresses for the funding prize).
- **LI.FI Composer** ⏳ — Flow orchestrating swap + CCTP-to-Arc (scaffolded; build the Flow).

## ⚠️ Security
The deploy key (in `contracts/.env`, gitignored) was shared in plaintext — **rotate it / don't put real funds on it**.
