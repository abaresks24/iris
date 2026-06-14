/**
 * LI.FI Composer — one-tap "deposit from any token, any chain → USDC on Arc".
 *
 * Composes a SINGLE Flow on the source chain:
 *   (optional) swap fromToken → USDC  →  CCTP depositForBurn(destDomain = Arc 26)
 * core.call carries the USDC approval inline, so the whole thing is one tx the
 * user signs. CCTP then mints native USDC on Arc.
 *
 * Endpoint: the ETHGlobal Composer staging API.
 *
 * ⚠️ Built against @lifi/composer-sdk@staging and NOT verified on-chain here
 * (needs source-chain funds + the staging API). The exact bind-port names may
 * need a tweak against the live staging SDK — marked below.
 */
import { createComposeSdk, resources, materialisers } from "@lifi/composer-sdk";
import { pad, type Address } from "viem";
import { CCTP } from "./arc";
import { CCTP_SOURCES } from "./cctp";

const COMPOSER_URL =
  process.env.NEXT_PUBLIC_LIFI_COMPOSER_URL ?? "https://ethglobal-composer.li.quest";

export interface ComposeDepositArgs {
  sourceChainId: number;
  fromToken: Address; // any token the user pays with
  amountWei: bigint; // raw amount of fromToken
  signer: Address; // sender + mint recipient on Arc
  apiKey?: string;
}

/** Build + compile the Composer Flow. Returns the compile result; send
 *  `result.transactionRequest` with the connected wallet (on the source chain). */
export async function composeDepositToArc(args: ComposeDepositArgs) {
  const src = CCTP_SOURCES[args.sourceChainId];
  if (!src) throw new Error(`No CCTP route to Arc from chain ${args.sourceChainId}`);

  const sdk = createComposeSdk({ baseUrl: COMPOSER_URL, apiKey: args.apiKey });
  const isUsdc = args.fromToken.toLowerCase() === src.usdc.toLowerCase();

  const builder = sdk.flow(args.sourceChainId, {
    name: "iris-deposit-to-arc",
    inputs: { amountIn: resources.erc20(args.fromToken, args.sourceChainId) },
  });

  // 1) swap → USDC (skipped if the user already pays in USDC)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usdc: any = builder.inputs.amountIn;
  if (!isUsdc) {
    const swap = builder.lifi.swap("swap", {
      bind: { amountIn: builder.inputs.amountIn },
      config: { resourceOut: resources.erc20(src.usdc, args.sourceChainId), slippage: 0.03 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usdc = (swap as any).amountOut;
  }

  // 2) CCTP burn to Arc (approval handled inline via `approvals`)
  const mintRecipient = pad(args.signer, { size: 32 });
  const zero32 = pad("0x", { size: 32 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (builder.core as any).call("burn", {
    bind: { amountIn: usdc },
    config: {
      target: src.tokenMessenger,
      functionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
      args: [usdc, CCTP.arcDomain, mintRecipient, src.usdc, zero32, 0, 2000],
      approvals: [{ spender: src.tokenMessenger }],
    },
  });

  const flow = builder.build();
  const request = sdk.request(flow, {
    signer: args.signer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputs: { amountIn: materialisers.directDeposit({ amount: args.amountWei.toString() } as any) },
    sweepTo: args.signer,
    simulationPolicy: "allow-revert",
  });

  return sdk.client.compile(request);
}
