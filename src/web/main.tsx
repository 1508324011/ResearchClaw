import React from 'react';
import ReactDOM from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import enTranslations from '../renderer/locales/en.json';
import zhTranslations from '../renderer/locales/zh.json';
import '../renderer/styles/globals.css';
import { setResearchClawClient } from '../renderer/hooks/use-ipc';
import { HttpClient } from '../renderer/lib/http-client';
import { router } from './router';

const savedLang = localStorage.getItem('researchclaw-language');
const initialLang: 'en' | 'zh' = savedLang === 'en' ? 'en' : 'zh';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    zh: { translation: zhTranslations },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

setResearchClawClient(new HttpClient(window.location.origin));

ReactDOM.createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
