import { expect, test } from "bun:test";
import { createPageActivity } from "@/lib/page-activity";

test("foreground samples use elapsed time and blur/hidden/pagehide/cleanup never double count", () => {
    let now = 0;
    const segments: number[] = [];
    const sample = createPageActivity(() => now, ms => segments.push(ms));
    sample(true);
    now = 30004; sample(true);
    now = 35000; sample(false); // blur
    now = 35010; sample(false); // visibilitychange
    now = 35020; sample(false); // pagehide
    sample(false); // route cleanup
    now = 90000; sample(true); // focus after hidden time
    now = 92000; sample(false);
    expect(segments).toEqual([30004, 4996, 2000]);
    expect(segments.reduce((sum, n) => sum + n, 0)).toBe(37000);
});

test("hidden startup and duplicate focus do not invent time; delayed ticks split at backend ceiling", () => {
    let now = 100;
    const segments: number[] = [];
    const sample = createPageActivity(() => now, ms => segments.push(ms));
    sample(false);
    now = 10000; sample(false);
    expect(segments).toEqual([]);
    sample(true); sample(true);
    now = 140123; sample(true);
    expect(segments).toEqual([60000, 60000, 10123]);
    sample(false); sample(false);
    expect(segments).toHaveLength(3);
});

test("sub-millisecond transition remainders are retained without cumulative rounding inflation", () => {
    let now = 0;
    const segments: number[] = [];
    const sample = createPageActivity(() => now, ms => segments.push(ms));
    sample(true);
    for (let i = 1; i <= 10; i++) { now = i / 10; sample(true); }
    sample(false);
    expect(segments).toEqual([1]);
});
