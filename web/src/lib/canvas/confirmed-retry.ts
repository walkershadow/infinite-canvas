/** Lock synchronously, confirm before any media preparation, and release on every exit. */
export async function runConfirmedRetry(active: Set<string>, id: string, confirm: () => Promise<void>, run: () => Promise<void>) {
    if (active.has(id)) return;
    active.add(id);
    try {
        await confirm();
        await run();
    } finally {
        active.delete(id);
    }
}
