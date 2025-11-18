const { startFeedClient } = require('./feedClient');
const { projectorLoop } = require('./projector');

async function main() {
  console.log('Starting minimal Event Store + Projector client...');

  // Start projector in background
  projectorLoop().catch(err => {
    console.error('[MAIN] Projector loop error:', err);
  });

  // Start feed client
  await startFeedClient();
}

main().catch(err => {
  console.error('[MAIN] Fatal error:', err);
  process.exit(1);
});
