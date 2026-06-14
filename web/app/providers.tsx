"use client";

import { createContext, useContext, useMemo } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import { deriveChain } from "@/lib/chains";
import { arcTestnet } from "@/lib/arc/vault";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const FundingContext = createContext({ privyEnabled: false });
export const useFunding = () => useContext(FundingContext);

const wagmiConfig = createConfig({
  chains: [arcTestnet, deriveChain, arbitrum, optimism, base, mainnet],
  transports: {
    [arcTestnet.id]: http(),
    [deriveChain.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const privyEnabled = Boolean(PRIVY_APP_ID);

  if (!privyEnabled) {
    // No Privy app id → run without wallet/funding; the trade flow (served by
    // the backend session key) still works end-to-end.
    return (
      <FundingContext.Provider value={{ privyEnabled: false }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </FundingContext.Provider>
    );
  }

  return (
    <FundingContext.Provider value={{ privyEnabled: true }}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          // Explicitly drive which methods the modal shows (each must ALSO be
          // enabled in the Privy dashboard). Without this, Privy relies solely on
          // the dashboard config, which can be cached client-side for a few minutes.
          loginMethods: ["google", "twitter", "github", "telegram", "wallet", "email"],
          appearance: { theme: "dark", accentColor: "#9D5BFF" },
          embeddedWallets: { createOnLogin: "users-without-wallets" },
          // Use a universally-recognised chain as the login default. External
          // wallets (Rabby/MetaMask) can fail to connect if forced onto the
          // obscure Derive Chain (957) on login; keep it only as supported.
          defaultChain: mainnet,
          supportedChains: [mainnet, arbitrum, optimism, base, arcTestnet, deriveChain],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </FundingContext.Provider>
  );
}
