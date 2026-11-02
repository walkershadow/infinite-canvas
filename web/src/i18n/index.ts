import { isOverseas, isDomestic } from "@/constant/integration";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "@/i18n/locales/en-US";
import zhCN from "@/i18n/locales/zh-CN";

export type AppLocale = "zh-CN" | "en-US";

const LOCALE_STORAGE_KEY = isDomestic ? "infinite-canvas:workbench:domestic:locale" : isOverseas ? "infinite-canvas:workbench:locale" : "infinite-canvas:locale";

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": { translation: isOverseas ? { ...zhCN, meta: { title: "画布 · AI Creator", description: "在 AI Creator 画布中使用图像、视频、文本与创作流程。" } } : zhCN },
        "en-US": { translation: isOverseas ? { ...enUS, meta: { title: "Canvas · AI Creator", description: "Create with images, video, text, and connected workflows in AI Creator Canvas." } } : enUS },
    },
    lng: (localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale) || (isOverseas ? "en-US" : "zh-CN"),
    fallbackLng: "zh-CN",
    supportedLngs: ["zh-CN", "en-US"],
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export function changeAppLocale(locale: AppLocale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return i18n.changeLanguage(locale);
}

export default i18n;
