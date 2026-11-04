import { isWorkbench } from "@/constant/integration";
import { useWorkbenchStore } from "@/stores/use-workbench-store";

export function useAssetFoldersEnabled() {
    const version = useWorkbenchStore(state => state.libraryVersion);
    return !isWorkbench || version === 2;
}
