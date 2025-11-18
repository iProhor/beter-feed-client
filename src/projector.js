const {
  getUnprocessedBatch,
  markProcessed
} = require('./eventStore');
const { projectorIntervalMs, projectorBatchSize } = require('./config');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// This is your "read model" applier.
// Here you can write to DB, update cache, etc.
// For now: just log.
async function applyEventToReadModel(event) {
  const { matchId, offset } = event;
  // TODO: replace this with real DB logic
  console.log(`[PROJECTOR] Applying event matchId=${matchId} offset=${offset}`);
}

async function projectorLoop() {
  // Never-ending loop
  while (true) {
    const batch = await getUnprocessedBatch(projectorBatchSize);

    if (batch.length === 0) {
      // Nothing to do – small sleep
      await sleep(projectorIntervalMs);
      continue;
    }

    for (const ev of batch) {
      try {
        await applyEventToReadModel(ev);
        await markProcessed(ev.id);
      } catch (err) {
        console.error('[PROJECTOR] Error applying event', ev.id, err);
        // TODO: dead-letter / retries if needed
      }
    }
  }
}

module.exports = { projectorLoop };
