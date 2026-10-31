import { expect, test } from "bun:test";
import { runConfirmedRetry } from "@/lib/canvas/confirmed-retry";

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
}

test("video retry confirms immediately and rapid clicks cannot duplicate slow media preparation or generation", async () => {
    const active = new Set<string>();
    const approval = deferred();
    const media = deferred();
    const events: string[] = [];
    const retry = () => runConfirmedRetry(active, "video", () => {
        events.push("confirm");
        return approval.promise;
    }, async () => {
        events.push("media");
        await media.promise;
        events.push("generate");
    });
    const first = retry();
    const duplicate = retry();
    expect(events).toEqual(["confirm"]);
    expect(active.has("video")).toBe(true);
    approval.resolve();
    await Promise.resolve();
    expect(events).toEqual(["confirm", "media"]);
    await retry();
    expect(events).toEqual(["confirm", "media"]);
    media.resolve();
    await Promise.all([first, duplicate]);
    expect(events).toEqual(["confirm", "media", "generate"]);
    expect(active.size).toBe(0);
});

test("cancelled confirmation never reads media and failed preparation releases the retry lock", async () => {
    const active = new Set<string>();
    let generated = 0;
    await expect(runConfirmedRetry(active, "video", async () => { throw new DOMException("Aborted", "AbortError"); }, async () => { generated++; })).rejects.toThrow("Aborted");
    expect(active.size).toBe(0);
    expect(generated).toBe(0);
    await expect(runConfirmedRetry(active, "video", async () => {}, async () => { throw new Error("media unavailable"); })).rejects.toThrow("media unavailable");
    expect(active.size).toBe(0);
    await runConfirmedRetry(active, "video", async () => {}, async () => { generated++; });
    expect(generated).toBe(1);
    expect(active.size).toBe(0);
});
