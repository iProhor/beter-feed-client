import { v4 as uuidv4 } from 'uuid';

// Simple in-memory event store
const events = []; // { id, matchId, offset, payload, receivedAt, processed }
const offsets = new Map(); // matchId -> lastOffset

export async function appendEvent({ matchId, offset, payload }) {
  const id = uuidv4();
  events.push({
    id,
    matchId,
    offset,
    payload,
    receivedAt: new Date(),
    processed: false
  });
  return id;
}

export async function getUnprocessedBatch(limit) {
  const batch = [];
  for (const e of events) {
    if (!e.processed) {
      batch.push(e);
      if (batch.length >= limit) break;
    }
  }
  return batch;
}

export async function markProcessed(id) {
  const ev = events.find(e => e.id === id);
  if (ev) {
    ev.processed = true;
  }
}

export async function getLastOffset(matchId) {
  return offsets.has(matchId) ? offsets.get(matchId) : null;
}

export async function setLastOffset(matchId, offset) {
  const current = offsets.get(matchId);
  if (current == null || offset > current) {
    offsets.set(matchId, offset);
  }
}

