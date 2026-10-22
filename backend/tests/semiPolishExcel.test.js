import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemiPolishExcel } from '../src/services/semiPolishExcelService.js';

test('4P process export creates a styled Excel record with packet and return data', () => {
  const workbook = buildSemiPolishExcel({
    issueNo: '4P-UN-20261021-1234',
    kapanNo: 'UN',
    vendorName: 'Demo Vendor',
    status: 'returned',
    issueDate: new Date('2026-10-20T00:00:00.000Z'),
    expectedReturnDate: new Date('2026-10-22T00:00:00.000Z'),
    issuedPieces: 2,
    issuedCarat: 26.26,
    returnedPieces: 2,
    returnedCarat: 25.5,
    returnDate: new Date('2026-10-21T00:00:00.000Z'),
    processLossCarat: 0.76,
    processLossPercentage: 2.89,
    issuedBy: { name: 'Operator' },
    receivedBy: { name: 'Receiver' },
    notes: 'Handle carefully',
    returnNotes: 'Received',
    packets: [
      { srNo: 1, name: 'UN-1A', grade: 'A', carat: 12.96 },
      { srNo: 2, name: 'UN-2A', grade: 'A', carat: 13.3 },
    ],
  });
  const storedXml = workbook.toString('utf8');

  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  assert.match(storedXml, /4P Process Record - 4P-UN-20261021-1234/);
  assert.match(storedXml, /Demo Vendor/);
  assert.match(storedXml, /UN-1A/);
  assert.match(storedXml, /Process Loss/);
  assert.match(storedXml, /Receiver/);
  assert.match(storedXml, /SUM\(D2:D3\)/);
  assert.match(storedXml, /pane ySplit="10" topLeftCell="A11"/);
  assert.match(
    storedXml,
    /numFmtId="164" fontId="4"[^>]*><alignment horizontal="center" vertical="center"\/></,
  );
});
