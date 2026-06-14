/** Server-side Derive config for Next API routes (reads Vercel/Node env). */
import { getConstants, type DeriveEnv } from "./constants";

const env = ((process.env.DERIVE_ENV as DeriveEnv) || "demo") as DeriveEnv;

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
export const ZERO_KEY = ("0x" + "0".repeat(64)) as `0x${string}`;

const owner = (process.env.DERIVE_OWNER_ADDRESS || ZERO_ADDR) as `0x${string}`;
const subaccountId = Number(process.env.DERIVE_SUBACCOUNT_ID || 0);
const sessionPrivateKey = (process.env.DERIVE_SESSION_PRIVATE_KEY || ZERO_KEY) as `0x${string}`;

export const constants = getConstants(env);

export const config = {
  env,
  constants,
  owner,
  subaccountId,
  sessionPrivateKey,
  get tradingEnabled(): boolean {
    return (
      sessionPrivateKey !== ZERO_KEY &&
      owner.toLowerCase() !== ZERO_ADDR &&
      subaccountId > 0
    );
  },
};

export type AppConfig = typeof config;
