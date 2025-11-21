import {
  getUnprocessedBatch,
  markProcessed
} from './eventStore';
import { config } from './config';

const { projectorIntervalMs, projectorBatchSize } = config;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// This is your "read model" applier.
// Here you can write to DB, update cache, etc.
// For now: just log.
async function applyEventToReadModel(event, logger) {
  const { matchId, offset } = event;
  // TODO: replace this with real DB logic
  if (logger) {
    logger('INFO', `[PROJECTOR] Applying event matchId=${matchId} offset=${offset}`);
  } else {
    console.log(`[PROJECTOR] Applying event matchId=${matchId} offset=${offset}`);
  }
}

export async function projectorLoop(logger) {
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
        await applyEventToReadModel(ev, logger);
        await markProcessed(ev.id);
      } catch (err) {
        if (logger) {
          logger('ERROR', `[PROJECTOR] Error applying event ${ev.id}: ${err.message}`);
        } else {
          console.error('[PROJECTOR] Error applying event', ev.id, err);
        }
        // TODO: dead-letter / retries if needed
      }
    }
  }
}

