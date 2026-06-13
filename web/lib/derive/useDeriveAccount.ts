"use client";

/**
 * Resolves the CONNECTED user's own Derive account, client-side:
 *   Privy embedded wallet (owner) → device session key → their subaccount(s).
 * No shared backend account; each user is isolated to their own funds.
 */
import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getOrCreateSessionKey, type DeviceSessionKey } from "./sessionKey";
import { getSubaccounts } from "./account";

export interface DeriveAccountState {
  owner?: `0x${string}`;
  sessionKey?: DeviceSessionKey;
  subaccountId?: number;
  onboarded: boolean;
  loading: boolean;
  error?: string;
}

export function useDeriveAccount(): DeriveAccountState {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const owner = wallets[0]?.address as `0x${string}` | undefined;
  const [state, setState] = useState<DeriveAccountState>({ onboarded: false, loading: false });

  useEffect(() => {
    if (!authenticated || !owner) {
      setState({ onboarded: false, loading: false });
      return;
    }
    const sk = getOrCreateSessionKey();
    let cancelled = false;
    setState({ owner, sessionKey: sk, onboarded: false, loading: true });

    // If the device session key isn't registered to this account yet, the
    // authed call fails → treat as "not onboarded" (needs the on-chain step).
    getSubaccounts(owner, sk.privateKey)
      .then((ids) => {
        if (cancelled) return;
        setState({
          owner,
          sessionKey: sk,
          subaccountId: ids[0],
          onboarded: ids.length > 0,
          loading: false,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ owner, sessionKey: sk, onboarded: false, loading: false, error: String(e?.message ?? e) });
      });

    return () => {
      cancelled = true;
    };
  }, [authenticated, owner]);

  return state;
}
