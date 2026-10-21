import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssortmentExcel } from '../src/services/assortmentExcelService.js';

test('assortment export creates an Excel workbook with packet data and totals', () => {
  const workbook = buildAssortmentExcel(
    {
      kapanNo: 'UN',
      totalPcs: 2,
      totalCarat: 26.26,
      entryDate: new Date('2026-10-21T00:00:00.000Z'),
    },
    [
      { srNo: 1, name: 'UN-1A', carat: 12.96 },
      { srNo: 2, name: 'UN-2A', carat: 13.3 },
    ]
  );
  const storedXml = workbook.toString('utf8');

  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  assert.match(storedXml, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/);
  assert.match(storedXml, /Packet Assortment - Lot UN/);
  assert.match(storedXml, /UN-1A/);
  assert.match(storedXml, /UN-2A/);
  assert.match(storedXml, /SUM\(D2:D3\)/);
  assert.doesNotMatch(storedXml, /UN-1\(A\)/);
});
