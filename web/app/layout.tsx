import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iris — options, anywhere",
  description:
    "Deposit any token from any chain, earn yield with options on Derive's permissionless orderbook.",
};

// Wallet/data providers (Privy + wagmi + react-query) wrap only the /app route
// group — the landing, docs and learn pages stay static and provider-free.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
