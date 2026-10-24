import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFourPProgress,
  buildLotAssortmentProgress,
} from '../src/controllers/lotController.js';

const lot = { totalPcs: 10, totalCarat: 5 };

test('lot assortment progress is pending before any packets are created', () => {
  assert.deepEqual(buildLotAssortmentProgress(lot), {
    assortmentComplete: false,
    assortmentStatus: 'pending',
    assortedPcs: 0,
    assortedCarat: 0,
  });
});

test('lot assortment progress is in progress after packets are created', () => {
  assert.deepEqual(
    buildLotAssortmentProgress(lot, { totalPackets: 4, totalCarat: 2.1254 }),
    {
      assortmentComplete: false,
      assortmentStatus: 'in_progress',
      assortedPcs: 4,
      assortedCarat: 2.125,
    }
  );
});

test('lot assortment progress is completed only at both exact targets', () => {
  assert.deepEqual(
    buildLotAssortmentProgress(lot, { totalPackets: 10, totalCarat: 5 }),
    {
      assortmentComplete: true,
      assortmentStatus: 'completed',
      assortedPcs: 10,
      assortedCarat: 5,
    }
  );
});

test('4P progress is pending and identifies whether the lot is ready', () => {
  assert.equal(buildFourPProgress(false).fourPReady, false);
  assert.deepEqual(buildFourPProgress(true), {
    fourPStatus: 'pending',
    fourPReady: true,
    fourPProcessId: null,
    fourPIssueNo: '',
    fourPVendorName: '',
    fourPExpectedPackets: 0,
    fourPReturnedPackets: 0,
  });
});

test('4P progress reports the current vendor and returned packets', () => {
  assert.deepEqual(
    buildFourPProgress(true, {
      _id: 'process-1',
      status: 'in_process',
      issueNo: '4P-UN-001',
      vendorName: 'Raisoni Polish',
      plannedPacketCount: 10,
      returnedPacketCount: 4,
    }),
    {
      fourPStatus: 'in_process',
      fourPReady: false,
      fourPProcessId: 'process-1',
      fourPIssueNo: '4P-UN-001',
      fourPVendorName: 'Raisoni Polish',
      fourPExpectedPackets: 10,
      fourPReturnedPackets: 4,
    }
  );
});

test('4P progress marks a returned process as completed', () => {
  const progress = buildFourPProgress(true, {
    _id: 'process-2',
    status: 'returned',
    plannedPacketCount: 10,
    returnedPacketCount: 10,
  });

  assert.equal(progress.fourPStatus, 'completed');
  assert.equal(progress.fourPReady, false);
});
