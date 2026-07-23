"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLanguage, translate, type Language, type LocaleKey } from "../locales";

type LocaleContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: LocaleKey) => string;
};

const STORAGE_KEY = "kmm-language";

export const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === "th" || value === "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) setLanguageState(saved);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  const t = useCallback((key: LocaleKey) => translate(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
