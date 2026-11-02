import zh from "@/i18n/workflow-zh";
import type { OverseasPromptEntry } from "@/types/prompt-catalog";
export const catalogText = (value: string, language: string) => language.startsWith("zh") ? zh[value] || value.replace("Original creator's external sample", "原作者外部样例").replace("(curator-reported)", "（整理站记录）") : value;
export const catalogTitle = (entry: OverseasPromptEntry, language: string) => language.startsWith("zh") ? entry.titleZh || entry.title : entry.title;
export const catalogSummary = (entry: OverseasPromptEntry, language: string) => language.startsWith("zh") ? entry.summaryZh || entry.summary : entry.summary;
