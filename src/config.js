// Browser-friendly config
// In a real app, you might use import.meta.env or similar
export const config = {
  // These might be overridden by UI inputs
  feedUrl: '',
  apiKey: '',
  snapshotBatchSize: 50,
  skipNegotiation: true,

  // Poll interval for projector loop (ms)
  projectorIntervalMs: 200,

  // Max events per projector batch
  projectorBatchSize: 100
};

