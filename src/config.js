require('dotenv').config();

const config = {
  feedUrl: process.env.FEED_URL,
  apiKey: process.env.FEED_API_KEY,
  snapshotBatchSize: Number(process.env.SNAPSHOT_BATCH_SIZE || 50),

  // Poll interval for projector loop (ms)
  projectorIntervalMs: 200,

  // Max events per projector batch
  projectorBatchSize: 100
};

module.exports = config;
