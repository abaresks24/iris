# Derive onboarding (one-time, to enable live orders)

The backend signs orders with a **session key** on an existing Derive account.
Creating that account + funding it is a one-time step Derive recommends doing
through their UX. After that, everything (read market, sign, place orders) is
programmatic.

## What the backend needs

Three values in `server/.env`:

```
DERIVE_OWNER_ADDRESS=0x...        # your Derive smart-contract wallet
DERIVE_SUBACCOUNT_ID=12345        # the subaccount you trade from
DERIVE_SESSION_PRIVATE_KEY=0x...  # a throwaway key registered as a session key
```

## Step 1 — Generate a session keypair

```bash
npm run signkey --prefix server
```

Prints a fresh `ADDRESS` + `PRIVATE KEY`. The private key goes in `.env`; the
address gets registered in step 4. Session keys **cannot withdraw to arbitrary
addresses**, so holding this key in the backend is safe.

## Testnet coordinates (verified)

| | value |
| --- | --- |
| Testnet app | **https://testnet.derive.xyz** |
| API | `api-demo.lyra.finance` (`DERIVE_ENV=demo`) |
| Derive testnet chain id | **901** |
| Testnet RPC | `https://rpc-prod-testnet-0eakp60405.t.conduit.xyz` |
| Test USDC (ERC20) | `0xe80F2a02398BBf1ab2C9cc52caD1978159c215BD` (6 decimals) |

## Step 2 — Get testnet gas + test USDC (no money)

- **Gas (testnet ETH on Derive Chain):** https://www.l2faucet.com/derive
  (device attestation via WebAuthn / Automata).
- **Test USDC:** get it **through the testnet app's deposit/faucet flow**. The
  test-USDC contract's `mint()` is **gated to Derive's bridge** (`mint` reverts
  with `only permitted` from any other caller), so you can't script it — it must
  come via the app's funnel (or bridge testnet USDC in from a Circle-faucet L2:
  https://faucet.circle.com).

> Everything here is free. No mainnet, no real funds — that's the whole point.

## Step 3 — Create account + subaccount and deposit

In the **testnet app (https://testnet.derive.xyz)**:

1. **Connect** your owner wallet.
2. **Deposit to Derive Chain** — the smart-contract wallet is created on first
   deposit; pull in the test USDC.
3. **Create / deposit to a subaccount** — note the **subaccount id** → this is
   `DERIVE_SUBACCOUNT_ID`. Your wallet address → `DERIVE_OWNER_ADDRESS`.

Docs: `docs.derive.xyz/reference/onboard-via-interface` and
`.../create-or-deposit-to-subaccount`.

## Step 4 — Register the session key

In the testnet app go to **Developers → Session Keys**
(`testnet.derive.xyz/developers`), and register the **address** from step 1.
(Programmatic registration is also possible via the on-chain session-key
registry, but the UX is quickest for a demo.)

## Step 5 — Wire `.env` and verify

```bash
# server/.env filled in, then:
npm run dev:server
curl http://localhost:8799/api/health
# → { ... "tradingEnabled": true, "subaccountId": 12345 }
```

Then from the UI (or `POST /api/trade`) place a small cash-secured put — it gets
EIP-712 signed by the session key and submitted to Derive's live orderbook. The
position appears under **Your positions on Derive**.

## How signing works (for reviewers)

Ported 1:1 from `derivexyz/v2-action-signing-python`:

1. ABI-encode the trade module data
   (`address, uint, int, int, uint, uint, bool`).
2. `keccak` it → `moduleDataHash`.
3. ABI-encode the action envelope
   (`typehash, subaccount, nonce, module, moduleDataHash, expiry, owner, signer`)
   → `keccak` → `actionHash`.
4. `typedDataHash = keccak(0x1901 ‖ DOMAIN_SEPARATOR ‖ actionHash)`.
5. Raw-sign `typedDataHash` with the session key (65-byte sig).

Auth (REST/WS) is an EIP-191 `personal_sign` of the current UTC-ms timestamp,
sent with the `X-LyraWallet / X-LyraTimestamp / X-LyraSignature` headers.

Constants live in `server/src/derive/constants.ts` (demo values verified; fill
mainnet from docs.derive.xyz Protocol Constants).
