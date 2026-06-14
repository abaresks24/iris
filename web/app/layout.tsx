import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Syne, Bodoni_Moda, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
});

// DA rysk.finance (bulles éducatives de la landing)
const ryskSerif = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-rysk-serif",
});
const ryskSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-rysk-sans",
});
const ryskMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-rysk-mono",
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
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} ${ryskSerif.variable} ${ryskSans.variable} ${ryskMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
