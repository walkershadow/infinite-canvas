export type VideoFramePosition = "first" | "last" | "current";

export async function captureVideoFrame(source: string, position: VideoFramePosition, currentTime: number, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    try {
        const metadataLoaded = waitForVideo(video, "loadedmetadata", signal);
        video.src = source;
        video.load();

        await metadataLoaded;
        const endTime = Math.max(0, video.duration - 0.001);
        const time = position === "first" ? 0 : position === "last" ? endTime : Math.min(currentTime, endTime);
        if (time) {
            const seeked = waitForVideo(video, "seeked", signal);
            video.currentTime = time;
            await seeked;
        } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await waitForVideo(video, "loadeddata", signal);
        }

        signal?.throwIfAborted();
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Failed to capture video frame"))), "image/png"));
    } finally {
        video.removeAttribute("src");
        video.load();
    }
}

function waitForVideo(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "seeked", signal?: AbortSignal) {
    signal?.throwIfAborted();
    return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
            video.removeEventListener(eventName, finish);
            video.removeEventListener("error", fail);
            signal?.removeEventListener("abort", abort);
        };
        const finish = () => { cleanup(); resolve(); };
        const fail = () => { cleanup(); reject(new Error("Failed to read video frame")); };
        const abort = () => { cleanup(); reject(signal?.reason); };
        video.addEventListener(eventName, finish);
        video.addEventListener("error", fail);
        signal?.addEventListener("abort", abort, { once: true });
    });
}
