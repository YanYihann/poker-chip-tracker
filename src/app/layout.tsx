import type { Metadata } from "next";
import { Manrope, Newsreader, Space_Grotesk } from "next/font/google";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const headlineFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-headline"
});

const labelFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-label"
});

export const metadata: Metadata = {
  title: "PokerChip Ledger",
  description: "Chip accounting and settlement for Texas Hold'em sessions"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${headlineFont.variable} ${labelFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
