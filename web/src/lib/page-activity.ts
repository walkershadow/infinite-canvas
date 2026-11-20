// The backend accepts at most 60 seconds per event; delayed timers retain all
// foreground time by splitting it, rather than inflating or truncating a segment.
export function createPageActivity(now: () => number, emit: (activeMs: number) => void) {
    let started: number | undefined;
    let remainder = 0;
    return (active: boolean) => {
        const end = now();
        if (started !== undefined) remainder += Math.max(0, end - started);
        started = active ? end : undefined;
        let elapsed = Math.floor(remainder);
        remainder -= elapsed;
        while (elapsed > 0) {
            const segment = Math.min(elapsed, 60000);
            emit(segment);
            elapsed -= segment;
        }
    };
}
