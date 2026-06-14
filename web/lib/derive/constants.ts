/**
 * Derive (ex-Lyra) protocol constants.
 *
 * Values verified against the official SDK example:
 *   github.com/derivexyz/v2-action-signing-python  (examples/order.py)
 * and the Protocol Constants table at docs.derive.xyz.
 *
 * The DOMAIN_SEPARATOR is precomputed per-environment (it bakes in chainId +
 * verifying contract), so we never recompute the EIP-712 domain on our side —
 * we just consume the constant, exactly like the official SDK does.
 */

export type DeriveEnv = "demo" | "prod";

export interface DeriveConstants {
  restUrl: string;
  wsUrl: string;
  domainSeparator: `0x${string}`;
  actionTypehash: `0x${string}`;
  tradeModuleAddress: `0x${string}`;
  depositModuleAddress: `0x${string}`;
  chainId: number;
}

/**
 * DEMO / testnet — verified working values (api-demo.lyra.finance).
 * Source: examples/order.py in derivexyz/v2-action-signing-python.
 */
const DEMO: DeriveConstants = {
  restUrl: "https://api-demo.lyra.finance",
  wsUrl: "wss://api-demo.lyra.finance/ws",
  domainSeparator:
    "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105",
  actionTypehash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17",
  tradeModuleAddress: "0x87F2863866D85E3192a35A73b388BD625D83f2be",
  // Deposit module — same address across Derive deployments per docs Protocol Constants.
  depositModuleAddress: "0x9B3FE5E5a3bcEa5df4E08c41Ce89C4e3Ff01Ace3",
  chainId: 901,
};

/**
 * PROD / mainnet (api.lyra.finance, Derive Chain id 957).
 *
 * ⚠️  NOT YET VERIFIED. The demo values above are confirmed against the SDK;
 * the mainnet DOMAIN_SEPARATOR, TRADE_MODULE_ADDRESS and DEPOSIT_MODULE_ADDRESS
 * MUST be copied from the Protocol Constants table at docs.derive.xyz before
 * using prod. The ACTION_TYPEHASH is protocol-wide and identical to demo.
 * Filling these in is the only step to flip the whole app to mainnet.
 */
const PROD: Partial<DeriveConstants> = {
  restUrl: "https://api.lyra.finance",
  wsUrl: "wss://api.lyra.finance/ws",
  actionTypehash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17",
  chainId: 957,
  // domainSeparator:    "0x..."  ← fill from docs.derive.xyz Protocol Constants
  // tradeModuleAddress: "0x..."  ← fill from docs.derive.xyz Protocol Constants
  // depositModuleAddress: "0x..." ← fill from docs.derive.xyz Protocol Constants
};

export function getConstants(env: DeriveEnv): DeriveConstants {
  if (env === "prod") {
    // Reads (public market data) need only the REST/WS URLs, so prod is always
    // usable read-only. The signing constants may be blank until filled — that
    // gap is enforced at order-signing time via canSign(), not here.
    return {
      restUrl: PROD.restUrl!,
      wsUrl: PROD.wsUrl!,
      actionTypehash: PROD.actionTypehash!,
      chainId: PROD.chainId!,
      domainSeparator: (PROD.domainSeparator ?? "") as `0x${string}`,
      tradeModuleAddress: (PROD.tradeModuleAddress ?? "") as `0x${string}`,
      depositModuleAddress: (PROD.depositModuleAddress ?? "") as `0x${string}`,
    };
  }
  return DEMO;
}

/** Whether the signing constants are present (required only to place orders). */
export function canSign(c: DeriveConstants): boolean {
  return (
    /^0x[0-9a-fA-F]{64}$/.test(c.domainSeparator) &&
    /^0x[0-9a-fA-F]{40}$/.test(c.tradeModuleAddress)
  );
}
