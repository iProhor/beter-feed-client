# BETER Feed Client (Minimal Event Store + Projector)

A minimal Node.js client that connects to a SignalR feed, appends incoming messages to an in-memory event store, and processes them asynchronously via a projector loop. This sketch demonstrates a fast, non-blocking ingestion path separated from read-model updates.

## Features
- SignalR client with automatic reconnect
- API key passed via query string (`?apiKey=...`)
- In-memory append-only event store with per-match offsets
- Background projector loop applying events to a read model (currently logs)
- Simple, production-friendly structure you can extend with real DB/cache writes

## Requirements
- Node.js 18+ recommended
- npm 8+

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (see below) in a `.env` file at the project root.
3. Start the client:
   ```bash
   npm start
   ```

You should see connection logs and periodic heartbeat warnings (if the server emits them). Those warnings are harmless unless you want to handle the heartbeat explicitly.

## Environment Variables
Define these in a `.env` file in the project root.

- `FEED_URL`: The SignalR hub URL for the feed.
  - Example: `https://your-feed-host.example.com/incident`
  - The client connects using SignalR and appends the API key as a query string.
- `FEED_API_KEY`: The API key used to authenticate to the feed.
  - Sent as a query string parameter: `?apiKey=<value>`
- `SNAPSHOT_BATCH_SIZE` (optional): Number used for snapshot pagination scenarios.
  - Default: `50`
  - Note: Present for completeness; the basic sample does not currently paginate snapshots.
- `SKIP_NEGOTIATION` (optional): When set to `true`, the client skips negotiation and connects directly via WebSockets.
  - Requires WebSockets to be supported end-to-end (no proxies blocking WS, correct hub endpoint).
  - Not supported with Azure SignalR Service (negotiation is required there).

Example `.env`:
```dotenv
FEED_URL=https://your-feed-host.example.com/incident
FEED_API_KEY=replace-with-your-key
SNAPSHOT_BATCH_SIZE=50
# Set to true to skip negotiation and force WebSockets
# SKIP_NEGOTIATION=true
```

## How It Works
- `src/feedClient.js`: Maintains a SignalR connection; on incoming `OnUpdate` messages, it performs minimal work: dedupe by offset and append to the event store.
- `src/eventStore.js`: In-memory store holding events and last processed offsets per `matchId`.
- `src/projector.js`: Background loop reading unprocessed events in batches and applying them to a read model (currently just logs). Safe place to write to DB/cache.
- `src/index.js`: Bootstraps the projector loop and starts the feed client.

## Notes & Next Steps
- Persistence: Replace the in-memory `eventStore` with a real database for durability.
- Read model: Implement `applyEventToReadModel` with your DB/cache updates.
- Heartbeats: If your server emits `onheartbeat`, you can add a handler:
  ```js
  // In feedClient.js, after building the connection
  connection.on('onheartbeat', () => {/* no-op or metrics */});
  ```
- Backpressure & retries: Add robust retry/dead-letter handling in the projector for production.

## Scripts
- `npm start`: Runs the client (`node src/index.js`).

## Folder Structure
```
src/
  config.js       # Loads env vars
  eventStore.js   # In-memory event store and offsets
  feedClient.js   # SignalR connection + ingestion
  index.js        # Entry point
  projector.js    # Background projector loop
```

---
Feel free to open issues or PRs to extend the sample (e.g., add persistence adapters, metrics, tests).