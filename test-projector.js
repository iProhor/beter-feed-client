console.log('Starting test...');

const {
  getUnprocessedBatch,
  markProcessed
} = require('./src/eventStore');

console.log('EventStore loaded');

const { projectorIntervalMs, projectorBatchSize } = require('./src/config');

console.log('Config loaded, projectorIntervalMs:', projectorIntervalMs);

async function projectorLoop() {
  console.log('projectorLoop function defined');
  return 'test';
}

console.log('Exporting projectorLoop...');
module.exports = {
  projectorLoop
};

console.log('Test complete');