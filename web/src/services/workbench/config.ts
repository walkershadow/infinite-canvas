import { inferVideoRatio } from "@/lib/media-size";
import { accountDatabaseName, workbenchSession } from "@/services/api/workbench";
import { defaultConfig, encodeChannelModel, modelOptionName, modelOptionsFromChannels, useConfigStore, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

export async function initializeWorkbenchConfig() {
    const hasPreferences = Boolean(window.localStorage.getItem(`${accountDatabaseName()}:preferences`));
    await useConfigStore.persist.rehydrate();
    const preferences = useConfigStore.getState().config;
    const session = workbenchSession();
    const models = [...session.models.filter(() => session.capabilities.video).map((model) => ({ name: model.id, capability: "video" as const })), ...(session.aiModels || []).filter(model => session.capabilities[model.capability]).map((model) => ({ name: model.id, capability: model.capability }))];
    const platform: ModelChannel = { id: "workbench", name: "Workbench", baseUrl: "/api/canvas", apiKey: "", apiFormat: "openai", models };
    const channels = [platform, ...preferences.channels.filter((channel) => channel.id !== "workbench")];
    const select = (capability: ModelCapability) => {
        const available = channels.flatMap((channel) => channel.models.filter((model) => model.capability === capability).map((model) => encodeChannelModel(channel.id, model.name)));
        const selected = preferences[`${capability}Model`];
        return hasPreferences && selected ? selected : available[0] || "";
    };
    const videoModel = select("video");
    const video = session.models.find((model) => model.id === modelOptionName(videoModel));
    useConfigStore.setState({ config: { ...defaultConfig, ...preferences, channels, models: modelOptionsFromChannels(channels), model: select("image") || select("text") || videoModel, videoModel, imageModel: select("image"), textModel: select("text"), audioModel: select("audio"), ...(video && platform.models.some((model) => encodeChannelModel(platform.id, model.name) === videoModel) ? { videoSeconds: video.durations.includes(Number(preferences.videoSeconds)) ? preferences.videoSeconds : String(video.defaultDuration), size: video.ratios.some((ratio) => ratio.value === inferVideoRatio(preferences.size)) ? preferences.size : video.ratios[0]?.value || "16:9" } : {}) } });
}
