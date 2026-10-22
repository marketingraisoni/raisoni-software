import {
  buildStyledExcel,
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

function buildWorksheet(process) {
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
    `${inlineCell('F5', 'Issued Pieces', 2)}${numberCell('G5', process.issuedPieces, 13)}${inlineCell('H5', 'Issued Carat', 2)}${numberCell('I5', process.issuedCarat, 15)}`,
    `${inlineCell('F6', 'Return Date', 2)}${optionalDateCell('G6', process.returnDate)}${inlineCell('H6', 'Returned Pieces', 2)}${optionalNumberCell('I6', process.returnedPieces, 13)}`,
    `${inlineCell('F7', 'Returned Carat', 2)}${optionalNumberCell('G7', process.returnedCarat, 15)}${inlineCell('H7', 'Process Loss', 2)}${optionalNumberCell('I7', process.processLossCarat, 15)}`,
    `${inlineCell('F8', 'Loss Percentage', 2)}${optionalNumberCell('G8', process.processLossPercentage, 15)}${inlineCell('H8', 'Issued By', 2)}${inlineCell('I8', process.issuedByName || '-', 3)}`,
    `${inlineCell('F9', 'Received By', 2)}${inlineCell('G9', process.receivedByName || '-', 3)}${inlineCell('H9', 'Return Remarks', 2)}${inlineCell('I9', process.returnNotes || '-', 3)}`,
    `${inlineCell('F10', 'Instructions', 2)}${inlineCell('G10', process.notes || '-', 3)}${inlineCell('H10', '', 2)}${inlineCell('I10', '', 3)}`,
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
      `${inlineCell(`A${totalRow}`, `Total issued - ${process.issuedPieces} PCs`, 9)}` +
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

function personName(person) {
  if (!person || typeof person !== 'object') return '';
  return person.name || person.username || '';
}

export function buildSemiPolishExcel(process) {
  return buildStyledExcel(
    '4P Process Record',
    buildWorksheet({
      ...process,
      issuedByName: personName(process.issuedBy),
      receivedByName: personName(process.receivedBy),
    })
  );
}
