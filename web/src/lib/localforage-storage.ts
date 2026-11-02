import { isWorkbench } from "@/constant/integration";
import { accountDatabaseName } from "@/services/api/workbench";
import localforage from "localforage";
import type { StateStorage } from "zustand/middleware";

localforage.config({
    name: isWorkbench ? accountDatabaseName() : "infinite-canvas",
    storeName: "app_state",
});

export const localForageStorage: StateStorage = {
    getItem: async (name) => {
        if (typeof window === "undefined") return null;
        try {
            return (await localforage.getItem<string>(name)) || null;
        } catch (error) {
            if (isWorkbench) throw error;
            return window.localStorage.getItem(name);
        }
    },
    setItem: async (name, value) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.setItem(name, value);
        } catch (error) {
            if (isWorkbench) throw error;
            window.localStorage.setItem(name, value);
        }
    },
    removeItem: async (name) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.removeItem(name);
        } catch (error) {
            if (isWorkbench) throw error;
            window.localStorage.removeItem(name);
        }
    },
};
