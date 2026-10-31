import type { ViewportTransform } from "@/types/canvas";

type Point = { x: number; y: number };
export function pinchViewport(viewport: ViewportTransform, before: [Point, Point], after: [Point, Point]): ViewportTransform {
    const distance = (points: [Point, Point]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const previousDistance = distance(before);
    if (!previousDistance) return viewport;
    const k = Math.min(5, Math.max(0.05, viewport.k * distance(after) / previousDistance));
    const center = (points: [Point, Point]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
    const oldCenter = center(before), newCenter = center(after);
    return { x: newCenter.x - (oldCenter.x - viewport.x) * k / viewport.k, y: newCenter.y - (oldCenter.y - viewport.y) * k / viewport.k, k };
}
