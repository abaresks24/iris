/**
 * Derive protocol constants (client-side mirror of the verified server values).
 * DEMO / testnet only — the values that make EIP-712 signing work in the browser.
 * Source: examples/order.py in derivexyz/v2-action-signing-python.
 */
export const DERIVE = {
  restUrl: "https://api-demo.lyra.finance",
  wsUrl: "wss://api-demo.lyra.finance/ws",
  chainId: 901,
  // L2 RPC for on-chain ops (session-key registration, deposits)
  rpcUrl: "https://rpc-prod-testnet-0eakp60405.t.conduit.xyz",
  domainSeparator:
    "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105" as `0x${string}`,
  actionTypehash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17" as `0x${string}`,
  tradeModuleAddress: "0x87F2863866D85E3192a35A73b388BD625D83f2be" as `0x${string}`,
  depositModuleAddress: "0x43223Db33AdA0575D2E100829543f8B04A37a1ec" as `0x${string}`,
  cashAddress: "0x6caf294DaC985ff653d5aE75b4FF8E0A66025928" as `0x${string}`,
  standardManager: "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
  usdcAddress: "0xe80F2a02398BBf1ab2C9cc52caD1978159c215BD" as `0x${string}`,
  // Matching contract — registers session keys. (Fill from docs.derive.xyz if needed.)
  matchingAddress: "" as `0x${string}` | "",
};
