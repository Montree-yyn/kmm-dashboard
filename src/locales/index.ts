import en from "./en";
import my from "./my";
import th from "./th";

export const locales = { th, en, my } as const;

export type Language = keyof typeof locales;
export type LocaleKey = keyof typeof en;

export const defaultLanguage: Language = "th";

export const intlLocales: Record<Language, string> = {
  th: "th-TH-u-nu-latn",
  en: "en-GB",
  my: "my-MM-u-nu-latn",
};

export function translate(language: Language, key: LocaleKey): string {
  return locales[language][key] ?? locales.en[key] ?? key;
}
