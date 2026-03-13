"use client";

import { createContext, useContext } from "react";
import en, { type Translations } from "./en";
import vi from "./vi";

export type Locale = "en" | "vi";

const translations: Record<Locale, Translations> = { en, vi };

export const I18nContext = createContext<Translations>(en);

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}

export function useT(): Translations {
  return useContext(I18nContext);
}

export { type Translations };
