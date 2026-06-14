import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Bodoni_Moda } from "next/font/google";
import "./globals.css";

// Rysk's type system: DM Sans (body) + DM Mono (numbers) + an elegant
// high-contrast serif for display (Rysk uses Bodoni Moda / Parabole).
const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-src",
});
const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-src",
});
const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Iris — options, anywhere",
  description:
    "Deposit any token from any chain, earn yield with options on Derive's permissionless orderbook.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
