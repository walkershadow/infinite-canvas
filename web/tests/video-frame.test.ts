import { expect, test } from "bun:test";
import { captureVideoFrame } from "../src/lib/canvas/canvas-video-frame";

test("aborting a stalled video cover releases media and listeners", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    let released = false;
    let loads = 0;
    class FakeVideo extends EventTarget {
        src = "";
        load() { loads++; }
        removeAttribute(name: string) { if (name === "src") { this.src = ""; released = true; } }
        override addEventListener(type: string, listener: any, options?: any) {
            const entries = listeners.get(type) || new Set(); entries.add(listener); listeners.set(type, entries);
            super.addEventListener(type, listener, options);
        }
        override removeEventListener(type: string, listener: any, options?: any) {
            listeners.get(type)?.delete(listener); super.removeEventListener(type, listener, options);
        }
    }
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => new FakeVideo() } });
    try {
        const controller = new AbortController();
        const pending = captureVideoFrame("/stalled-video", "first", 0, controller.signal);
        controller.abort(new Error("Cover timeout"));
        await expect(pending).rejects.toThrow("Cover timeout");
        expect(released).toBe(true);
        expect(loads).toBe(2);
        expect([...listeners.values()].every((entries) => entries.size === 0)).toBe(true);
        await expect(captureVideoFrame("/unused-video", "first", 0, controller.signal)).rejects.toThrow("Cover timeout");
        expect(loads).toBe(2);
    } finally {
        if (previous) Object.defineProperty(globalThis, "document", previous);
        else Reflect.deleteProperty(globalThis, "document");
    }
});
