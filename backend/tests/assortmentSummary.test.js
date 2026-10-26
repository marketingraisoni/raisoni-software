import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPacketData,
  buildPacketName,
  buildSummary,
} from '../src/controllers/assortmentPacketController.js';
import { withLocalAssortmentWriteQueue } from '../src/services/assortmentWriteLockService.js';
import { AssortmentPacket } from '../src/models/AssortmentPacket.js';
import { assortmentPacketSchema } from '../src/validators/assortmentPacketValidator.js';

test('packet names combine the lot, continuous sequence, and primary grade', () => {
  assert.equal(buildPacketName('UN', 9), 'UN-9A');
});

test('packet summary contains only totals needed by the Grade A screen', () => {
  const summary = buildSummary(
    { totalPcs: 3, totalCarat: 0.6 },
    [
      { carat: 0.1 },
      { carat: 0.2 },
    ]
  );

  assert.deepEqual(summary, {
    totalPackets: 2,
    totalCarat: 0.3,
    remainingPackets: 1,
    remainingCarat: 0.3,
    complete: false,
  });
});

test('packet summary marks the assortment complete at its exact targets', () => {
  const summary = buildSummary({ totalPcs: 2, totalCarat: 0.3 }, [
    { carat: 0.1 },
    { carat: 0.2 },
  ]);

  assert.equal(summary.complete, true);
  assert.equal(summary.remainingPackets, 0);
  assert.equal(summary.remainingCarat, 0);
});

test('packet data returns a compact packet contract with the Grade A name', () => {
  const result = buildPacketData(
    { kapanNo: 'UN', totalPcs: 137, totalCarat: 13.7 },
    [
      { _id: 'packet-1', srNo: 1, grade: 'B', carat: 0.1 },
      { _id: 'packet-2', srNo: 2, grade: 'C', carat: 0.1 },
    ]
  );

  assert.deepEqual(result.packets, [
    { id: 'packet-1', srNo: 1, name: 'UN-1A', carat: 0.1 },
    { id: 'packet-2', srNo: 2, name: 'UN-2A', carat: 0.1 },
  ]);
});

test('packet creation requests for the same lot run in submission order', async () => {
  const events = [];
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = withLocalAssortmentWriteQueue('lot-1', async () => {
    events.push('first-started');
    await firstCanFinish;
    events.push('first-finished');
  });
  const second = withLocalAssortmentWriteQueue('lot-1', async () => {
    events.push('second-started');
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['first-started']);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, [
    'first-started',
    'first-finished',
    'second-started',
  ]);
});

test('packet creation requires an idempotency request ID', () => {
  assert.equal(
    assortmentPacketSchema.safeParse({
      carat: 0.125,
      requestId: 'packet-request-1',
    }).success,
    true
  );
  assert.equal(assortmentPacketSchema.safeParse({ carat: 0.125 }).success, false);
});

test('packet model has unique sequence and idempotency indexes per lot', () => {
  const indexes = AssortmentPacket.schema.indexes();
  assert.equal(
    indexes.some(
      ([fields, options]) =>
        fields.lot === 1 && fields.srNo === 1 && options.unique === true
    ),
    true
  );
  assert.equal(
    indexes.some(
      ([fields, options]) =>
        fields.lot === 1 && fields.requestId === 1 && options.unique === true
    ),
    true
  );
});
