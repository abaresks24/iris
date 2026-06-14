/** Server-side Derive config for Next API routes (reads Vercel/Node env). */
import { getConstants, type DeriveEnv } from "./constants";

const env = ((process.env.DERIVE_ENV as DeriveEnv) || "demo") as DeriveEnv;

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
export const ZERO_KEY = ("0x" + "0".repeat(64)) as `0x${string}`;

const owner = (process.env.DERIVE_OWNER_ADDRESS || ZERO_ADDR) as `0x${string}`;
const subaccountId = Number(process.env.DERIVE_SUBACCOUNT_ID || 0);
const sessionPrivateKey = (process.env.DERIVE_SESSION_PRIVATE_KEY || ZERO_KEY) as `0x${string}`;

// Liquidity/maker account (a SEPARATE Derive account, different owner) that
// posts the opposite side of each user order so it fills instantly. Optional:
// if unset, orders just rest on the book.
const makerOwner = (process.env.MAKER_OWNER_ADDRESS || ZERO_ADDR) as `0x${string}`;
const makerSubaccountId = Number(process.env.MAKER_SUBACCOUNT_ID || 0);
const makerSessionPrivateKey = (process.env.MAKER_SESSION_PRIVATE_KEY || ZERO_KEY) as `0x${string}`;

export const constants = getConstants(env);

export interface AccountCreds {
  owner: `0x${string}`;
  subaccountId: number;
  sessionPrivateKey: `0x${string}`;
}

export const config = {
  env,
  constants,
  owner,
  subaccountId,
  sessionPrivateKey,
  maker: {
    owner: makerOwner,
    subaccountId: makerSubaccountId,
    sessionPrivateKey: makerSessionPrivateKey,
  } as AccountCreds,
  get tradingEnabled(): boolean {
    return (
      sessionPrivateKey !== ZERO_KEY &&
      owner.toLowerCase() !== ZERO_ADDR &&
      subaccountId > 0
    );
  },
  /** True when a separate maker account is configured to auto-fill user orders. */
  get makerEnabled(): boolean {
    return (
      makerSessionPrivateKey !== ZERO_KEY &&
      makerOwner.toLowerCase() !== ZERO_ADDR.toLowerCase() &&
      makerSubaccountId > 0 &&
      makerOwner.toLowerCase() !== owner.toLowerCase()
    );
  },
};

export type AppConfig = typeof config;
