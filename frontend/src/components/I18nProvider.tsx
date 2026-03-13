"use client";

import { useState, useEffect, useCallback } from "react";
import { I18nContext, getTranslations, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "qitekshop_locale";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem(STORAGE_KEY) as Locale) || "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        setLocale(e.newValue as Locale);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback(() => {
    setLocale((prev) => (prev === "en" ? "vi" : "en"));
  }, []);

  // Expose toggle on window for the language switcher
  useEffect(() => {
    (window as Record<string, unknown>).__toggleLocale = toggle;
    (window as Record<string, unknown>).__currentLocale = locale;
    window.dispatchEvent(new CustomEvent("localechange", { detail: locale }));
  }, [locale, toggle]);

  return (
    <I18nContext.Provider value={getTranslations(locale)}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale((localStorage.getItem(STORAGE_KEY) as Locale) || "en");
    function handleChange(e: Event) {
      setLocale((e as CustomEvent).detail as Locale);
    }
    window.addEventListener("localechange", handleChange);
    return () => window.removeEventListener("localechange", handleChange);
  }, []);

  const toggle = useCallback(() => {
    const fn = (window as Record<string, unknown>).__toggleLocale as (() => void) | undefined;
    if (fn) fn();
  }, []);

  return { locale, toggle };
}
