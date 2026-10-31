import { inferVideoRatio } from "@/lib/media-size";
import { modelOptionName, type AiConfig } from "@/stores/use-config-store";
import { workbenchSession } from "@/services/api/workbench";

export function workbenchVideoInput(config: AiConfig) {
    const session = workbenchSession();
    const model = session.models.find((item) => item.id === modelOptionName(config.model || config.videoModel));
    if (!session.capabilities.video || !model) throw new Error("Select an available Workbench video model.");
    const duration = Number(config.videoSeconds);
    const baseRatio = inferVideoRatio(config.size);
    if (model.id === "ali-video" && !["720", "1080"].includes(config.vquality)) throw new Error("ali-video supports 720p or 1080p.");
    const ratio = model.id === "ali-video" && config.vquality === "1080" ? `${baseRatio}-1080p` : baseRatio;
    if (!model.durations.includes(duration)) throw new Error(`Choose a supported duration: ${model.durations.join(", ")} seconds.`);
    if (!model.ratios.some((item) => item.value === ratio)) throw new Error("Choose an aspect ratio supported by this model.");
    const unitPrice = model.prices?.[duration] ?? model.price;
    const points = unitPrice * (model.billingUnit === "second" ? duration : 1);
    if (!Number.isFinite(points) || points < 0 || !(session.pointsPerUsd > 0)) throw new Error("Workbench pricing is unavailable. Refresh the model catalog before generating.");
    return { model, duration, ratio, points, currency: session.currency, usd: points / session.pointsPerUsd };
}

/** Keep frame and ordinary references mutually exclusive; never discard excess inputs. */
export function workbenchVideoReferenceMode(model: import("@/types/workbench").WorkbenchModel, mode: string, counts: { images: number; videos: number; audios: number }) {
    for (const [kind, supported, maximum] of [["images", model.supportsImage, model.maxImages], ["videos", model.supportsVideo, model.maxVideos], ["audios", model.supportsAudio, model.maxAudios]] as const) {
        if (counts[kind] && !supported) throw new Error(`This model does not support reference ${kind}.`);
        if (maximum != null && counts[kind] > maximum) throw new Error(`This model accepts at most ${maximum} reference ${kind}. Disconnect extra references before generating.`);
    }
    if (!model.supportsFrames || mode === "reference") return "reference";
    if (counts.videos || counts.audios) throw new Error("Frame mode cannot include video or audio references. Choose Reference mode for mixed media.");
    if (counts.images > 2) throw new Error("Frame mode accepts one first frame or two first/last frames. Choose Reference mode for more images.");
    return counts.images === 2 ? "first-last" : counts.images === 1 ? "first" : "none";
}
