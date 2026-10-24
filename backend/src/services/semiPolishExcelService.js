import {
  buildStyledWorkbook,
  excelDate,
  inlineCell,
  numberCell,
} from './assortmentExcelService.js';

function optionalDateCell(reference, value) {
  return value
    ? numberCell(reference, excelDate(value), 11)
    : inlineCell(reference, 'Not specified', 3);
}

function optionalNumberCell(reference, value, style = 8) {
  return value === null || value === undefined
    ? inlineCell(reference, '-', 3)
    : numberCell(reference, value, style);
}

function optionalPercentageCell(reference, value, style = 15) {
  if (value === null || value === undefined || value === '') {
    return inlineCell(reference, '-', 3);
  }
  const numeric = Number(value);
  const formatted = Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : `${value}%`;
  return inlineCell(reference, formatted, style);
}

function buildProcessWorksheet(process) {
  const packets = process.packets || [];
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + packets.length - 1;
  const totalRow = Math.max(lastDataRow + 1, 11);
  const rows = [];

  rows.push(
    `<row r="1" ht="28" customHeight="1">` +
      `${inlineCell('A1', 'SR. NO.', 4)}` +
      `${inlineCell('B1', 'PACKET NUMBER', 4)}` +
      `${inlineCell('C1', 'GRADE', 4)}` +
      `${inlineCell('D1', 'CARAT (CT)', 5)}` +
      `<c r="E1" s="0"/>` +
      `${inlineCell('F1', `4P Process Record - ${process.issueNo}`, 1)}` +
      `<c r="G1" s="1"/><c r="H1" s="1"/><c r="I1" s="1"/>` +
    `</row>`
  );

  const details = [
    `${inlineCell('F2', 'Issue / Jangad No', 2)}${inlineCell('G2', process.issueNo, 3)}${inlineCell('H2', 'Status', 2)}${inlineCell('I2', String(process.status).replace('_', ' '), 12)}`,
    `${inlineCell('F3', 'Lot / Kapan', 2)}${inlineCell('G3', process.kapanNo, 3)}${inlineCell('H3', '4P Vendor', 2)}${inlineCell('I3', process.vendorName, 3)}`,
    `${inlineCell('F4', 'Issue Date', 2)}${optionalDateCell('G4', process.issueDate)}${inlineCell('H4', 'Expected Return', 2)}${optionalDateCell('I4', process.expectedReturnDate)}`,
    `${inlineCell('F5', 'Issued Pkt', 2)}${numberCell('G5', process.issuedPieces, 13)}${inlineCell('H5', 'Issued Carat', 2)}${numberCell('I5', process.issuedCarat, 15)}`,
    `${inlineCell('F6', 'Return Date', 2)}${optionalDateCell('G6', process.returnDate)}${inlineCell('H6', 'Returned Pieces', 2)}${optionalNumberCell('I6', process.returnedPieces, 13)}`,
    `${inlineCell('F7', 'Returned Carat', 2)}${optionalNumberCell('G7', process.returnedCarat, 15)}${inlineCell('H7', 'Process Loss', 2)}${optionalNumberCell('I7', process.processLossCarat, 15)}`,
    `${inlineCell('F8', 'Loss Percentage', 2)}${optionalPercentageCell('G8', process.processLossPercentage, 15)}${inlineCell('H8', 'Issued By', 2)}${inlineCell('I8', process.issuedByName || '-', 3)}`,
    `${inlineCell('F9', 'Received By', 2)}${inlineCell('G9', process.receivedByName || '-', 3)}${inlineCell('H9', 'Return Remarks', 2)}${inlineCell('I9', process.returnNotes || '-', 3)}`,
    `${inlineCell('F10', 'Instructions', 2)}${inlineCell('G10', process.notes || '-', 3)}${inlineCell('H10', process.plannedYieldPercentage != null ? 'Planned Yield' : '', 2)}${process.plannedYieldPercentage != null ? optionalPercentageCell('I10', process.plannedYieldPercentage, 3) : inlineCell('I10', '', 3)}`,
  ];

  const finalDetailRow = details.length + 1;
  const maxContentRow = Math.max(lastDataRow, finalDetailRow);
  for (let rowNumber = 2; rowNumber <= maxContentRow; rowNumber += 1) {
    const packet = packets[rowNumber - firstDataRow];
    let content = '';

    if (packet) {
      content +=
        `${numberCell(`A${rowNumber}`, packet.srNo, 6)}` +
        `${inlineCell(`B${rowNumber}`, packet.name, 7)}` +
        `${inlineCell(`C${rowNumber}`, packet.grade || 'A', 7)}` +
        `${numberCell(`D${rowNumber}`, packet.carat, 8)}`;
    }

    const detail = details[rowNumber - 2];
    if (detail) content += `<c r="E${rowNumber}" s="0"/>${detail}`;
    rows.push(`<row r="${rowNumber}" ht="20" customHeight="1">${content}</row>`);
  }

  const formula = packets.length ? `SUM(D2:D${lastDataRow})` : '';
  rows.push(
    `<row r="${totalRow}" ht="24" customHeight="1">` +
      `${inlineCell(`A${totalRow}`, `Total issued - ${process.issuedPieces} Pkt`, 9)}` +
      `<c r="B${totalRow}" s="9"/><c r="C${totalRow}" s="9"/>` +
      `${numberCell(`D${totalRow}`, process.issuedCarat, 10, formula)}` +
    `</row>`
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="10" topLeftCell="A11" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="2" width="24" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="4" customWidth="1"/>
    <col min="6" max="6" width="19" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
    <col min="8" max="8" width="18" customWidth="1"/>
    <col min="9" max="9" width="24" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  ${packets.length ? `<autoFilter ref="A1:D${lastDataRow}"/>` : ''}
  <mergeCells count="2">
    <mergeCell ref="F1:I1"/>
    <mergeCell ref="A${totalRow}:C${totalRow}"/>
  </mergeCells>
</worksheet>`;
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCarat(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 1000) / 1000;
}

function planningGroups(process, packetPlans) {
  const groups = new Map();

  for (const plan of packetPlans) {
    const grade = String(plan.planningGrade || 'Unspecified').trim() || 'Unspecified';
    const current = groups.get(grade) || {
      grade,
      pieces: 0,
      roughCarat: 0,
      polishedCarat: 0,
    };
    current.pieces += numberOrZero(plan.plannedPieceCount);
    current.roughCarat += numberOrZero(plan.roughCarat);
    current.polishedCarat += numberOrZero(plan.plannedPolishedCarat);
    groups.set(grade, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      lot: `${process.kapanNo}-(${group.grade})`,
      yieldPercentage: group.roughCarat
        ? (group.polishedCarat / group.roughCarat) * 100
        : 0,
    }))
    .sort((left, right) => left.grade.localeCompare(right.grade));
}

function buildPlanningSummaryWorksheet(process, planningImport, packetPlans) {
  const groups = planningGroups(process, packetPlans);
  const groupStartRow = 10;
  const totalRow = groupStartRow + groups.length;
  const rows = [
    `<row r="1" ht="28" customHeight="1">${inlineCell('A1', `Imported Planning Summary - ${process.issueNo}`, 1)}<c r="B1" s="1"/><c r="C1" s="1"/><c r="D1" s="1"/><c r="E1" s="1"/></row>`,
    `<row r="2" ht="20" customHeight="1">${inlineCell('A2', 'Original workbook', 2)}${inlineCell('B2', planningImport.originalFileName || '-', 3)}${inlineCell('D2', 'Import version', 2)}${numberCell('E2', planningImport.version || 1, 6)}</row>`,
    `<row r="3" ht="20" customHeight="1">${inlineCell('A3', 'Lot / Kapan', 2)}${inlineCell('B3', process.kapanNo, 3)}${inlineCell('D3', 'Imported sheet', 2)}${inlineCell('E3', planningImport.sheetName || 'FILE', 3)}</row>`,
    `<row r="4" ht="20" customHeight="1">${inlineCell('A4', 'Planned packets', 2)}${numberCell('B4', planningImport.packetCount || packetPlans.length, 13)}${inlineCell('D4', 'Planned pieces', 2)}${numberCell('E4', planningImport.plannedPieceCount, 13)}</row>`,
    `<row r="5" ht="20" customHeight="1">${inlineCell('A5', 'Planning rough', 2)}${numberCell('B5', planningImport.planningRoughCarat, 15)}${inlineCell('D5', 'Planned polished', 2)}${numberCell('E5', planningImport.plannedPolishedCarat, 15)}</row>`,
    `<row r="6" ht="20" customHeight="1">${inlineCell('A6', 'Planned yield', 2)}${optionalPercentageCell('B6', planningImport.plannedYieldPercentage, 15)}${inlineCell('D6', 'Matched packets', 2)}${numberCell('E6', planningImport.matchedPacketCount, 13)}</row>`,
    `<row r="8" ht="24" customHeight="1">${inlineCell('A8', 'Grade-wise planning summary', 1)}<c r="B8" s="1"/><c r="C8" s="1"/><c r="D8" s="1"/><c r="E8" s="1"/></row>`,
    `<row r="9" ht="22" customHeight="1">${inlineCell('A9', 'LOT', 4)}${inlineCell('B9', 'PCS', 4)}${inlineCell('C9', 'R.WT.', 5)}${inlineCell('D9', 'POL CTS.', 5)}${inlineCell('E9', 'Y%', 5)}</row>`,
  ];

  groups.forEach((group, index) => {
    const row = groupStartRow + index;
    rows.push(
      `<row r="${row}" ht="20" customHeight="1">` +
        `${inlineCell(`A${row}`, group.lot, 7)}` +
        `${numberCell(`B${row}`, group.pieces, 6)}` +
        `${numberCell(`C${row}`, roundCarat(group.roughCarat), 8)}` +
        `${numberCell(`D${row}`, roundCarat(group.polishedCarat), 8)}` +
        `${optionalPercentageCell(`E${row}`, group.yieldPercentage, 15)}` +
      `</row>`,
    );
  });

  rows.push(
    `<row r="${totalRow}" ht="24" customHeight="1">` +
      `${inlineCell(`A${totalRow}`, 'TOTAL', 9)}` +
      `${numberCell(`B${totalRow}`, planningImport.plannedPieceCount, 13)}` +
      `${numberCell(`C${totalRow}`, planningImport.planningRoughCarat, 10)}` +
      `${numberCell(`D${totalRow}`, planningImport.plannedPolishedCarat, 10)}` +
      `${optionalPercentageCell(`E${totalRow}`, planningImport.plannedYieldPercentage, 15)}` +
    `</row>`,
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="5" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="2"><mergeCell ref="A1:E1"/><mergeCell ref="A8:E8"/></mergeCells>
</worksheet>`;
}

function returnStatusLabel(packetReturn) {
  if (!packetReturn) return 'Pending';
  if (packetReturn.status === 'verified') return 'Verified';
  if (packetReturn.status === 'issue') return 'Issue reported';
  return 'Partially received';
}

function readableDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '-';
  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    date.getUTCFullYear(),
  ].join('/');
}

function packetDetailNumberCell(reference, value, style) {
  return value === null || value === undefined
    ? inlineCell(reference, '-', style)
    : numberCell(reference, value, style);
}

function buildPacketDetailsWorksheet(process, packetPlans, packetReturns) {
  const returnsByPacket = new Map(
    packetReturns.map((packetReturn) => [packetReturn.packetNumber, packetReturn]),
  );
  const rows = [
    `<row r="1" ht="32" customHeight="1">${inlineCell('A1', `Packet Planning & Received Pieces - ${process.issueNo}`, 1)}${Array.from({ length: 14 }, (_, index) => `<c r="${String.fromCharCode(66 + index)}1" s="1"/>`).join('')}</row>`,
    `<row r="2" ht="27" customHeight="1">` +
      `${inlineCell('A2', 'PACKET / PCS NO.', 4)}` +
      `${inlineCell('B2', 'PLANNING LOT', 4)}` +
      `${inlineCell('C2', 'GRADE', 4)}` +
      `${inlineCell('D2', 'ROUGH CT', 5)}` +
      `${inlineCell('E2', 'PLANNED CT', 5)}` +
      `${inlineCell('F2', 'HPHT CT', 5)}` +
      `${inlineCell('G2', '4P CT', 5)}` +
      `${inlineCell('H2', 'SHAPE', 4)}` +
      `${inlineCell('I2', 'CUT', 4)}` +
      `${inlineCell('J2', 'COLOR', 4)}` +
      `${inlineCell('K2', 'CLARITY', 4)}` +
      `${inlineCell('L2', 'LS', 4)}` +
      `${inlineCell('M2', 'BARCODE', 4)}` +
      `${inlineCell('N2', 'RETURN STATUS', 4)}` +
      `${inlineCell('O2', 'RECEIVED DATE', 4)}` +
    `</row>`,
  ];
  let rowNumber = 3;

  for (const plan of packetPlans) {
    const packetReturn = returnsByPacket.get(plan.packetNumber);
    const receivedByPiece = new Map(
      (packetReturn?.receivedPieces || []).map((piece) => [piece.pieceNumber, piece]),
    );
    const receivedNumbers = new Set(packetReturn?.receivedPieceNumbers || []);
    const plannedPieces = plan.pieces || [];
    const plannedNumbers = new Set(plannedPieces.map((piece) => piece.pieceNumber));
    const extraReceivedPieces = [...receivedByPiece.values()].filter(
      (piece) => !plannedNumbers.has(piece.pieceNumber),
    );
    const groupPieces = [
      ...plannedPieces.map((piece) => ({ planned: piece, received: receivedByPiece.get(piece.pieceNumber) })),
      ...extraReceivedPieces.map((piece) => ({ planned: null, received: piece })),
    ];
    const packetLabel = plan.rawPacketLabel || `${process.kapanNo}-${plan.packetNumber}`;
    const issueText = packetReturn?.issue?.reported
      ? packetReturn.issue.type || packetReturn.issue.details || 'Issue reported'
      : returnStatusLabel(packetReturn);

    rows.push(
      `<row r="${rowNumber}" ht="25" customHeight="1">` +
        `${inlineCell(`A${rowNumber}`, packetLabel, 17)}` +
        `${inlineCell(`B${rowNumber}`, plan.planningLotNo || '-', 16)}` +
        `${inlineCell(`C${rowNumber}`, plan.planningGrade || '-', 16)}` +
        `${numberCell(`D${rowNumber}`, plan.roughCarat, 16)}` +
        `${numberCell(`E${rowNumber}`, plan.plannedPolishedCarat, 16)}` +
        `${inlineCell(`F${rowNumber}`, `${plan.plannedPieceCount} PCS`, 16)}` +
        `<c r="G${rowNumber}" s="16"/><c r="H${rowNumber}" s="16"/><c r="I${rowNumber}" s="16"/><c r="J${rowNumber}" s="16"/><c r="K${rowNumber}" s="16"/><c r="L${rowNumber}" s="16"/><c r="M${rowNumber}" s="16"/>` +
        `${inlineCell(`N${rowNumber}`, issueText, 16)}` +
        `${inlineCell(`O${rowNumber}`, readableDate(packetReturn?.receivedAt), 18)}` +
      `</row>`,
    );
    rowNumber += 1;

    for (const [pieceIndex, entry] of groupPieces.entries()) {
      const planned = entry.planned;
      const received = entry.received;
      const pieceNumber = planned?.pieceNumber ?? received?.pieceNumber;
      const isReceived = Boolean(received || receivedNumbers.has(pieceNumber));
      const isLastPiece = pieceIndex === groupPieces.length - 1;
      const middleStyle = isLastPiece ? 22 : 19;
      const leftStyle = isLastPiece ? 23 : 20;
      const rightStyle = isLastPiece ? 24 : 21;
      const receivedStyle = isLastPiece ? 26 : 25;
      rows.push(
        `<row r="${rowNumber}" ht="22" customHeight="1" outlineLevel="1">` +
          `${inlineCell(`A${rowNumber}`, pieceNumber, leftStyle)}` +
          `${inlineCell(`B${rowNumber}`, '', middleStyle)}` +
          `${inlineCell(`C${rowNumber}`, '', middleStyle)}` +
          `${inlineCell(`D${rowNumber}`, '-', middleStyle)}` +
          `${packetDetailNumberCell(`E${rowNumber}`, planned?.polishedCarat, middleStyle)}` +
          `${packetDetailNumberCell(`F${rowNumber}`, received?.hphtCarat, middleStyle)}` +
          `${packetDetailNumberCell(`G${rowNumber}`, received?.fourPCarat, middleStyle)}` +
          `${inlineCell(`H${rowNumber}`, received?.shape || planned?.shape || '-', middleStyle)}` +
          `${inlineCell(`I${rowNumber}`, planned?.cut || '-', middleStyle)}` +
          `${inlineCell(`J${rowNumber}`, planned?.color || '-', middleStyle)}` +
          `${inlineCell(`K${rowNumber}`, planned?.clarity || '-', middleStyle)}` +
          `${inlineCell(`L${rowNumber}`, planned?.ls || '-', middleStyle)}` +
          `${inlineCell(`M${rowNumber}`, received?.barcode || '-', middleStyle)}` +
          `${inlineCell(`N${rowNumber}`, isReceived ? 'Received' : 'Pending', isReceived ? receivedStyle : middleStyle)}` +
          `${inlineCell(`O${rowNumber}`, readableDate(received?.receivedDate), rightStyle)}` +
        `</row>`,
      );
      rowNumber += 1;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><outlinePr summaryBelow="0"/></sheetPr>
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="22" customHeight="1" outlineLevelRow="1"/>
  <cols>
    <col min="1" max="1" width="21" customWidth="1"/>
    <col min="2" max="2" width="25" customWidth="1"/>
    <col min="3" max="3" width="11" customWidth="1"/>
    <col min="4" max="4" width="13" customWidth="1"/>
    <col min="5" max="5" width="15" customWidth="1"/>
    <col min="6" max="7" width="12" customWidth="1"/>
    <col min="8" max="8" width="18" customWidth="1"/>
    <col min="9" max="9" width="13" customWidth="1"/>
    <col min="10" max="10" width="11" customWidth="1"/>
    <col min="11" max="11" width="14" customWidth="1"/>
    <col min="12" max="12" width="9" customWidth="1"/>
    <col min="13" max="13" width="24" customWidth="1"/>
    <col min="14" max="14" width="20" customWidth="1"/>
    <col min="15" max="15" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <autoFilter ref="A2:O${Math.max(rowNumber - 1, 2)}"/>
  <mergeCells count="1"><mergeCell ref="A1:O1"/></mergeCells>
</worksheet>`;
}

function personName(person) {
  if (!person || typeof person !== 'object') return '';
  return person.name || person.username || '';
}

export function buildSemiPolishExcel(
  process,
  { planningImport = null, packetPlans = [], packetReturns = [] } = {},
) {
  const enrichedProcess = {
    ...process,
    issuedByName: personName(process.issuedBy),
    receivedByName: personName(process.receivedBy),
  };
  const sheets = [
    {
      name: '4P Process Record',
      worksheet: buildProcessWorksheet(enrichedProcess),
    },
  ];

  if (planningImport && packetPlans.length > 0) {
    sheets.push(
      {
        name: 'Planning Summary',
        worksheet: buildPlanningSummaryWorksheet(
          enrichedProcess,
          planningImport,
          packetPlans,
        ),
      },
      {
        name: 'Packet Details',
        worksheet: buildPacketDetailsWorksheet(
          enrichedProcess,
          packetPlans,
          packetReturns,
        ),
      },
    );
  }

  return buildStyledWorkbook(sheets);
}
