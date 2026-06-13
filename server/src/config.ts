import "dotenv/config";
import { z } from "zod";
import { getConstants, type DeriveEnv } from "./derive/constants.js";

const Env = z.object({
  DERIVE_ENV: z.enum(["demo", "prod"]).default("demo"),
  DERIVE_OWNER_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default("0x0000000000000000000000000000000000000000"),
  DERIVE_SUBACCOUNT_ID: z.coerce.number().int().nonnegative().default(0),
  DERIVE_SESSION_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .default("0x" + "0".repeat(64)),
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = Env.parse(process.env);

const env = parsed.DERIVE_ENV as DeriveEnv;
export const constants = getConstants(env);

/**
 * Whether trading credentials are actually configured. When false the server
 * still runs and serves all public/market endpoints — only signed actions
 * (placing orders) require a real session key + account.
 */
export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
export const ZERO_KEY = ("0x" + "0".repeat(64)) as `0x${string}`;

export const config = {
  env,
  constants,
  owner: parsed.DERIVE_OWNER_ADDRESS as `0x${string}`,
  subaccountId: parsed.DERIVE_SUBACCOUNT_ID,
  sessionPrivateKey: parsed.DERIVE_SESSION_PRIVATE_KEY as `0x${string}`,
  port: parsed.PORT,
  corsOrigins: parsed.CORS_ORIGIN.split(",").map((s) => s.trim()),
  get tradingEnabled(): boolean {
    return (
      this.sessionPrivateKey !== ZERO_KEY &&
      this.owner.toLowerCase() !== ZERO_ADDR &&
      this.subaccountId > 0
    );
  },
};

export type AppConfig = typeof config;
