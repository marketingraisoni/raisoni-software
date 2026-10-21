import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPacketData,
  buildPacketName,
  buildSummary,
} from '../src/controllers/assortmentPacketController.js';

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
