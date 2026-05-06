/**
 * LanguageContext — global multilingual state for BJCC mobile.
 * Persists selection to AsyncStorage, handles RTL switching.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { getTranslations } from '../constants/translations';
import { BJCC_LANGUAGES } from '../constants/languages';

const STORAGE_KEY = 'bjcc_selected_lang';

const LanguageContext = createContext({
  lang: 'en',
  langObj: BJCC_LANGUAGES[0],
  t: {},
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [t, setT] = useState(getTranslations('en'));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved) applyLang(saved);
    });
  }, []);

  const applyLang = useCallback((code) => {
    setLangState(code);
    setT(getTranslations(code));
    const langObj = BJCC_LANGUAGES.find(l => l.code === code);
    const isRTL = langObj?.rtl || false;
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
    AsyncStorage.setItem(STORAGE_KEY, code);
  }, []);

  const langObj = BJCC_LANGUAGES.find(l => l.code === lang) || BJCC_LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ lang, langObj, t, setLang: applyLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
