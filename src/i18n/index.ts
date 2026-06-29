import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import { getItem as storeGet, setItem as storeSet } from '@/utils/storage';

import en from './locales/en.json';
import fr from './locales/fr.json';

const SUPPORTED = ['en', 'fr'];

function getDefaultLocale(): string {
  try {
    if (Platform.OS === 'web') {
      return SUPPORTED.includes(navigator.language?.slice(0, 2)) ? navigator.language.slice(0, 2) : 'en';
    }
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const locale = getLocales()?.[0]?.languageCode;
    return locale && SUPPORTED.includes(locale) ? locale : 'en';
  } catch {
    return 'en';
  }
}

async function loadLanguage(): Promise<string> {
  try {
    const saved = await storeGet('app_language');
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {}
  return getDefaultLocale();
}

export const readyPromise = loadLanguage().then((lang) => {
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

export async function changeLanguage(lang: 'en' | 'fr') {
  await i18n.changeLanguage(lang);
  await storeSet('app_language', lang);
}

export function getCurrentLanguage(): 'en' | 'fr' {
  const lng = i18n.language?.slice(0, 2);
  return lng === 'fr' ? 'fr' : 'en';
}

export default i18n;
