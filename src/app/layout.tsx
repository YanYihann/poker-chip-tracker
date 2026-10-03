import type { Metadata } from "next";
import { Manrope, Bungee } from "next/font/google";

import { LanguageProvider } from "@/components/i18n/language-provider";
import { AudioProvider } from "@/components/audio/audio-provider";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const labelFont = Bungee({
  weight: "400",
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
    <html lang="en-US">
      <body className={`${bodyFont.variable} ${labelFont.variable}`}>
        <LanguageProvider><AudioProvider>{children}</AudioProvider></LanguageProvider>
      </body>
    </html>
  );
}
