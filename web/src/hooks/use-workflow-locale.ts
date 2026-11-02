import { useTranslation } from "react-i18next";
import { catalogText } from "@/lib/prompt-catalog-locale";
export function useWorkflowLocale() {
    const { i18n } = useTranslation();
    const language: "zh" | "en" = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
    return { language, text: (value: string) => catalogText(value, language) };
}
