const signalR = require('@microsoft/signalr');
const {
  feedUrl,
  apiKey
} = require('./config');
const {
  appendEvent,
  getLastOffset,
  setLastOffset
} = require('./eventStore');

// Helper: build connection
function buildConnection() {
  if (!feedUrl || !apiKey) {
    throw new Error('FEED_URL or FEED_API_KEY not set in .env');
  }

  // Using API key in query string
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${feedUrl}?apiKey=${encodeURIComponent(apiKey)}`)
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

  return connection;
}

async function startFeedClient() {
  const connection = buildConnection();

  // This is the key: OnUpdate only appends to store and returns fast
  connection.on('OnUpdate', async (messages) => {
    // messages: array of messages from feed snapshot / updates
    if (!Array.isArray(messages)) {
      console.warn('[FEED] OnUpdate received non-array payload');
      return;
    }

    // No heavy logic here: only offset check + append
    for (const msg of messages) {
      try {
        // TODO: adjust based on your real contract
        // Example assuming:
        // msg.matchId, msg.offset, msg.incidents, msg.channel, etc.
        const matchId = msg.matchId || msg.id;
        const offset = msg.offset;

        if (!matchId || typeof offset !== 'number') {
          // If your schema is different, adjust here.
          console.warn('[FEED] Skipping message without matchId/offset');
          continue;
        }
        const msgType = msg.msgType || 'unknown';
        const lastOffset = await getLastOffset(matchId);
        console.log(`[FEED] Received msgType=${msgType} matchId=${matchId} offset=${offset} lastOffset=${lastOffset}`);
        // Skip old / already processed events
        if (lastOffset !== null && offset <= lastOffset) {
          continue;
        }

        await appendEvent({
          matchId,
          offset,
          payload: msg
        });

        await setLastOffset(matchId, offset);
      } catch (err) {
        console.error('[FEED] Error appending event:', err);
      }
    }
  });

  connection.onreconnecting(error => {
    console.warn('[FEED] Reconnecting...', error ? error.message : '');
  });

  connection.onreconnected(connectionId => {
    console.log('[FEED] Reconnected with connectionId:', connectionId);
  });
  connection.on('onsystemevent', () => {
    console.warn('[FEED] onsystemevent ');
  });
  connection.on('onheartbeat', () => {
    console.log('[FEED] Heartbeat received');
  });
  connection.onclose(error => {
    console.error('[FEED] Connection closed', error ? error.message : '');
  });

  async function startWithRetry() {
    while (true) {
      try {
        console.log('[FEED] Starting connection to', feedUrl);
        await connection.start();
        console.log('[FEED] Connected. ConnectionId:', connection.connectionId);
        break;
      } catch (err) {
        console.error('[FEED] Failed to connect, retrying in 5s...', err.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  await startWithRetry();

  // If your hub requires calling a subscription method, do it here:
  // await connection.invoke('Subscribe', { /* ... */ });
}

module.exports = {
  startFeedClient
};
