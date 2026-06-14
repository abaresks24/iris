/**
 * Iris protocol SDK — read & write the OptionVault on Arc testnet.
 * Reads use the Arc public client; writes take a viem WalletClient (from
 * wagmi/Privy: `useWalletClient()`), so the front only wires UI to these calls.
 */
import {
  formatUnits,
  parseUnits,
  type Address,
  type WalletClient,
} from "viem";
import { ADDR, arcClient, arcTestnet, ETH_MARKET_ID, USDC_DECIMALS } from "./arc";
import { optionVaultAbi } from "./optionVaultAbi";
import { erc20Abi, aggregatorAbi } from "./erc20Abi";

const PRICE_DECIMALS = 8;
const nowSec = () => Math.floor(Date.now() / 1000);

// ───────────────────────── Reads ─────────────────────────

/** Live ETH/USD spot (from the Chainlink-compatible feed). */
export async function getSpotUsd(): Promise<number> {
  const r = (await arcClient.readContract({
    address: ADDR.ethUsdFeed,
    abi: aggregatorAbi,
    functionName: "latestRoundData",
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
  return Number(r[1]) / 10 ** PRICE_DECIMALS;
}

export interface Quote {
  collateral: number; // put: USDC · call: ETH
  collateralAsset: "USDC" | "ETH";
  premium: number; // USDC, paid upfront
  aprPct: number;
}

export async function quotePut(
  strikeUsd: number,
  sizeEth: number,
  expirySec: number,
  marketId = ETH_MARKET_ID,
): Promise<Quote> {
  const [collateral, premium] = (await arcClient.readContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "quoteCashSecuredPut",
    args: [marketId, parseUnits(strikeUsd.toString(), PRICE_DECIMALS), parseUnits(sizeEth.toString(), 18), BigInt(expirySec)],
  })) as readonly [bigint, bigint];
  const c = Number(formatUnits(collateral, USDC_DECIMALS));
  const p = Number(formatUnits(premium, USDC_DECIMALS));
  const days = (expirySec - nowSec()) / 86_400;
  return { collateral: c, collateralAsset: "USDC", premium: p, aprPct: c > 0 && days > 0 ? (p / c) * (365 / days) * 100 : 0 };
}

export async function quoteCall(
  sizeEth: number,
  expirySec: number,
  marketId = ETH_MARKET_ID,
): Promise<Quote> {
  const [collateral, premium] = (await arcClient.readContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "quoteCoveredCall",
    args: [marketId, parseUnits(sizeEth.toString(), 18), BigInt(expirySec)],
  })) as readonly [bigint, bigint];
  const collEth = Number(formatUnits(collateral, 18));
  const p = Number(formatUnits(premium, USDC_DECIMALS));
  const spot = await getSpotUsd();
  const collUsd = collEth * spot;
  const days = (expirySec - nowSec()) / 86_400;
  return { collateral: collEth, collateralAsset: "ETH", premium: p, aprPct: collUsd > 0 && days > 0 ? (p / collUsd) * (365 / days) * 100 : 0 };
}

export interface Position {
  id: number;
  writer: Address;
  kind: "cash_secured_put" | "covered_call";
  strike: number;
  size: number;
  premium: number;
  openedAt: number;
  expiry: number;
  settled: boolean;
}

export async function getPositions(writer?: Address): Promise<Position[]> {
  const len = Number(
    (await arcClient.readContract({ address: ADDR.optionVault, abi: optionVaultAbi, functionName: "positionsLength" })) as bigint,
  );
  const out: Position[] = [];
  for (let i = 0; i < len; i++) {
    const p = (await arcClient.readContract({
      address: ADDR.optionVault,
      abi: optionVaultAbi,
      functionName: "positions",
      args: [BigInt(i)],
    })) as readonly [Address, number, number, bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    if (writer && p[0].toLowerCase() !== writer.toLowerCase()) continue;
    out.push({
      id: i,
      writer: p[0],
      kind: Number(p[1]) === 0 ? "cash_secured_put" : "covered_call",
      strike: Number(p[3]) / 10 ** PRICE_DECIMALS,
      size: Number(formatUnits(p[4], 18)),
      premium: Number(formatUnits(p[6], USDC_DECIMALS)),
      openedAt: Number(p[7]),
      expiry: Number(p[8]),
      settled: p[9],
    });
  }
  return out;
}

export async function getBalances(account: Address) {
  const [usdc, weth] = await Promise.all([
    arcClient.readContract({ address: ADDR.usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] }) as Promise<bigint>,
    arcClient.readContract({ address: ADDR.weth, abi: erc20Abi, functionName: "balanceOf", args: [account] }) as Promise<bigint>,
  ]);
  return { usdc: Number(formatUnits(usdc, USDC_DECIMALS)), weth: Number(formatUnits(weth, 18)) };
}

// ───────────────────────── Writes ─────────────────────────
// `wallet` is a viem WalletClient (wagmi useWalletClient); `account` its address.

async function ensureAllowance(wallet: WalletClient, account: Address, token: Address, amount: bigint) {
  const allowance = (await arcClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, ADDR.optionVault],
  })) as bigint;
  if (allowance >= amount) return;
  const hash = await wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [ADDR.optionVault, amount],
    account,
    chain: arcTestnet,
  });
  await arcClient.waitForTransactionReceipt({ hash });
}

/** Sell a cash-secured put: approves USDC collateral, then opens. Returns tx hash. */
export async function openPut(
  wallet: WalletClient,
  account: Address,
  strikeUsd: number,
  sizeEth: number,
  expirySec: number,
  marketId = ETH_MARKET_ID,
): Promise<`0x${string}`> {
  const strike = parseUnits(strikeUsd.toString(), PRICE_DECIMALS);
  const size = parseUnits(sizeEth.toString(), 18);
  const [collateral] = (await arcClient.readContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "quoteCashSecuredPut",
    args: [marketId, strike, size, BigInt(expirySec)],
  })) as readonly [bigint, bigint];
  await ensureAllowance(wallet, account, ADDR.usdc, collateral);
  const hash = await wallet.writeContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "openCashSecuredPut",
    args: [marketId, strike, size, BigInt(expirySec)],
    account,
    chain: arcTestnet,
  });
  await arcClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Sell a covered call: approves WETH collateral, then opens. */
export async function openCall(
  wallet: WalletClient,
  account: Address,
  strikeUsd: number,
  sizeEth: number,
  expirySec: number,
  marketId = ETH_MARKET_ID,
): Promise<`0x${string}`> {
  const strike = parseUnits(strikeUsd.toString(), PRICE_DECIMALS);
  const size = parseUnits(sizeEth.toString(), 18);
  await ensureAllowance(wallet, account, ADDR.weth, size);
  const hash = await wallet.writeContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "openCoveredCall",
    args: [marketId, strike, size, BigInt(expirySec)],
    account,
    chain: arcTestnet,
  });
  await arcClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function settle(wallet: WalletClient, account: Address, id: number): Promise<`0x${string}`> {
  const hash = await wallet.writeContract({
    address: ADDR.optionVault,
    abi: optionVaultAbi,
    functionName: "settle",
    args: [BigInt(id)],
    account,
    chain: arcTestnet,
  });
  await arcClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Test-WETH faucet (public mint) so covered calls are testable. */
export async function mintTestWeth(wallet: WalletClient, account: Address, amountEth: number): Promise<`0x${string}`> {
  const hash = await wallet.writeContract({
    address: ADDR.weth,
    abi: erc20Abi,
    functionName: "mint",
    args: [account, parseUnits(amountEth.toString(), 18)],
    account,
    chain: arcTestnet,
  });
  await arcClient.waitForTransactionReceipt({ hash });
  return hash;
}
