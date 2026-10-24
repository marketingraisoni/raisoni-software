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
  assert.match(storedXml, /2\.89%/);
  assert.match(storedXml, /pane ySplit="10" topLeftCell="A11"/);
  assert.match(
    storedXml,
    /numFmtId="164" fontId="4"[^>]*><alignment horizontal="center" vertical="center"\/></,
  );
});

test('4P process export adds imported planning and grouped received-piece sheets', () => {
  const workbook = buildSemiPolishExcel(
    {
      issueNo: '4P-UN-20261021-5832',
      kapanNo: 'UN',
      vendorName: 'Rajesh',
      status: 'in_process',
      issueDate: new Date('2026-10-21T00:00:00.000Z'),
      issuedPieces: 2,
      issuedCarat: 12.96,
      issuedBy: { name: 'Raisoni Jauharis' },
      packets: [{ srNo: 1, name: 'UN-1A', grade: 'A', carat: 12.96 }],
    },
    {
      planningImport: {
        originalFileName: 'LOT-NEVD-UN-11-09-2026.xlsx',
        version: 1,
        sheetName: 'FILE',
        packetCount: 1,
        plannedPieceCount: 2,
        planningRoughCarat: 12.96,
        plannedPolishedCarat: 4.07,
        plannedYieldPercentage: 31.4,
        matchedPacketCount: 1,
      },
      packetPlans: [
        {
          packetNumber: 1,
          rawPacketLabel: 'UN-1A',
          planningGrade: 'A',
          planningLotNo: 'NEVD-UN/5',
          roughCarat: 12.96,
          plannedPieceCount: 2,
          plannedPolishedCarat: 4.07,
          yieldPercentage: 31.4,
          pieces: [
            {
              pieceNumber: 1,
              polishedCarat: 2.04,
              shape: 'MARQUISE',
              cut: 'IGI',
              color: 'F',
              clarity: 'VS1',
              ls: '',
            },
            {
              pieceNumber: 2,
              polishedCarat: 2.03,
              shape: 'PEAR',
              cut: 'IGI',
              color: 'F',
              clarity: 'VS1',
              ls: '',
            },
          ],
        },
      ],
      packetReturns: [
        {
          packetNumber: 1,
          status: 'partial',
          receivedPieceNumbers: [1],
          receivedAt: new Date('2026-10-24T00:00:00.000Z'),
          receivedPieces: [
            {
              pieceNumber: 1,
              hphtCarat: 5,
              fourPCarat: 2.04,
              shape: 'MARQUISE',
              barcode: 'BC-UN-1-1',
              receivedDate: new Date('2026-10-24T00:00:00.000Z'),
            },
          ],
        },
      ],
    },
  );
  const storedXml = workbook.toString('utf8');

  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  assert.match(storedXml, /Planning Summary/);
  assert.match(storedXml, /Packet Details/);
  assert.match(storedXml, /xl\/worksheets\/sheet2\.xml/);
  assert.match(storedXml, /xl\/worksheets\/sheet3\.xml/);
  assert.match(storedXml, /LOT-NEVD-UN-11-09-2026\.xlsx/);
  assert.match(storedXml, /UN-\(A\)/);
  assert.match(storedXml, /PACKET \/ PCS NO\./);
  assert.match(storedXml, /HPHT CT/);
  assert.match(storedXml, /4P CT/);
  assert.match(storedXml, /BC-UN-1-1/);
  assert.doesNotMatch(storedXml, /Piece #/);
  assert.match(storedXml, /<t>2<\/t>/);
  assert.match(storedXml, /2 PCS/);
  assert.match(storedXml, /outlineLevel="1"/);
  assert.match(storedXml, /summaryBelow="0"/);
  assert.match(
    storedXml,
    /sheetFormatPr defaultRowHeight="22" customHeight="1" outlineLevelRow="1"/,
  );
  assert.match(storedXml, /Partially received/);
  assert.match(storedXml, /borderId="11"/);
  assert.match(storedXml, /borderId="12"/);
  assert.match(storedXml, /borderId="8"/);
  assert.match(storedXml, /borderId="9"/);
  assert.match(storedXml, /24\/10\/2026/);
  assert.match(storedXml, /<col min="2" max="2" width="25"/);
  assert.match(storedXml, /<col min="13" max="13" width="24"/);
  assert.match(storedXml, /r="2" ht="27" customHeight="1"/);
  assert.match(storedXml, /ht="25" customHeight="1"/);
  assert.match(storedXml, /ht="22" customHeight="1" outlineLevel="1"/);
});
