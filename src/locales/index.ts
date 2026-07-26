import en from "./en";
import th from "./th";

export const locales = { th, en } as const;

export type Language = keyof typeof locales;
export type LocaleKey = keyof typeof en;

export const defaultLanguage: Language = "th";

export function translate(language: Language, key: LocaleKey) {
  return locales[language][key] ?? locales.en[key] ?? key;
}
