"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLocale = "zh" | "en";

const LOCALE_STORAGE_KEY = "pokerchip.locale";

const LanguageContext = createContext<{
  locale: AppLocale;
  isZh: boolean;
  localeTag: "zh-CN" | "en-US";
  setLocale: (nextLocale: AppLocale) => void;
  toggleLocale: () => void;
} | null>(null);

function resolveInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "zh";
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function getLocaleTag(locale: AppLocale): "zh-CN" | "en-US" {
  return locale === "zh" ? "zh-CN" : "en-US";
}

type LanguageProviderProps = {
  children: ReactNode;
};

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [locale, setLocale] = useState<AppLocale>("zh");

  useEffect(() => {
    setLocale(resolveInitialLocale());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = getLocaleTag(locale);
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      isZh: locale === "zh",
      localeTag: getLocaleTag(locale),
      setLocale,
      toggleLocale: () => setLocale((prev) => (prev === "zh" ? "en" : "zh"))
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }
  return context;
}
