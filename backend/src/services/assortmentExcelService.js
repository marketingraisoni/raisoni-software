const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosTimestamp(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const timestamp = getDosTimestamp();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.content, 'utf8');
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function inlineCell(reference, value, style = 0) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

export function numberCell(reference, value, style = 0, formula = '') {
  const formulaXml = formula ? `<f>${escapeXml(formula)}</f>` : '';
  return `<c r="${reference}" s="${style}">${formulaXml}<v>${Number(value)}</v></c>`;
}

export function excelDate(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? (timestamp / 86400000) + 25569 : 0;
}

function buildWorksheet(lot, packets) {
  const firstDataRow = 2;
  const lastDataRow = firstDataRow + packets.length - 1;
  const totalRow = Math.max(lastDataRow + 1, 5);

  const rows = [];

  // Row 1: Left = Table Headers, Right = Title Banner
  rows.push(
    `<row r="1" ht="28" customHeight="1">` +
      `${inlineCell('A1', 'SR. NO.', 4)}` +
      `${inlineCell('B1', 'PACKET NUMBER', 4)}` +
      `${inlineCell('C1', 'GRADE', 4)}` +
      `${inlineCell('D1', 'CARAT (CT)', 5)}` +
      `<c r="E1" s="0"/>` +
      `${inlineCell('F1', `Packet Assortment - Lot ${lot.kapanNo}`, 1)}` +
      `<c r="G1" s="1"/><c r="H1" s="1"/><c r="I1" s="1"/>` +
    `</row>`
  );

  // Rows 2, 3, 4: Data rows on Left + Info Box on Right
  const rightBoxRows = [
    `${inlineCell('F2', 'Lot Number', 2)}${inlineCell('G2', lot.kapanNo, 3)}${inlineCell('H2', 'Grade', 2)}${inlineCell('I2', 'A', 3)}`,
    `${inlineCell('F3', 'Entry Date', 2)}${numberCell('G3', excelDate(lot.entryDate), 11)}${inlineCell('H3', 'Status', 2)}${inlineCell('I3', 'Complete', 12)}`,
    `${inlineCell('F4', 'Total Pieces', 2)}${numberCell('G4', lot.totalPcs, 13)}${inlineCell('H4', 'Total Carat', 2)}${numberCell('I4', lot.totalCarat, 14)}`,
  ];

  const maxDataOrBoxRow = Math.max(lastDataRow, 4);

  for (let r = 2; r <= maxDataOrBoxRow; r += 1) {
    const packetIndex = r - firstDataRow;
    const packet = packets[packetIndex];
    let rowContent = '';

    if (packet) {
      rowContent +=
        `${numberCell(`A${r}`, packet.srNo, 6)}` +
        `${inlineCell(`B${r}`, packet.name, 7)}` +
        `${inlineCell(`C${r}`, packet.grade || 'A', 7)}` +
        `${numberCell(`D${r}`, packet.carat, 8)}`;
    }

    const boxContent = rightBoxRows[r - 2];
    if (boxContent) {
      rowContent += `<c r="E${r}" s="0"/>` + boxContent;
    }

    const rowHeight = r === 4 ? '22' : '20';
    rows.push(`<row r="${r}" ht="${rowHeight}" customHeight="1">${rowContent}</row>`);
  }

  // Total row for the table
  rows.push(
    `<row r="${totalRow}" ht="24" customHeight="1">` +
      `${inlineCell(`A${totalRow}`, 'Total', 9)}` +
      `<c r="B${totalRow}" s="9"/><c r="C${totalRow}" s="9"/>` +
      `${numberCell(`D${totalRow}`, lot.totalCarat, 10, `SUM(D2:D${lastDataRow})`)}` +
    `</row>`
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="2" width="24" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="4" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="16" customWidth="1"/>
    <col min="9" max="9" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <autoFilter ref="A1:D${lastDataRow}"/>
  <mergeCells count="2">
    <mergeCell ref="F1:I1"/>
    <mergeCell ref="A${totalRow}:C${totalRow}"/>
  </mergeCells>
</worksheet>`;
}

function buildContentTypes(sheetCount) {
  const worksheetOverrides = Array.from(
    { length: sheetCount },
    (_, index) =>
      `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

const rootRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function safeSheetName(value, index) {
  const cleaned = String(value || `Sheet ${index + 1}`)
    .replace(/[\\/*?:\[\]]/g, ' ')
    .trim();
  return (cleaned || `Sheet ${index + 1}`).slice(0, 31);
}

function buildWorkbook(sheets) {
  const sheetNodes = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(safeSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNodes}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

function buildWorkbookRelationships(sheetCount) {
  const worksheetRelationships = Array.from(
    { length: sheetCount },
    (_, index) =>
      `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${worksheetRelationships}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="0.000"/>
    <numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>
    <numFmt numFmtId="166" formatCode="#,##0"/>
  </numFmts>
  <fonts count="6">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/><color rgb="FF000000"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF15803D"/><name val="Calibri"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC4D79B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="13">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="medium"><color rgb="FF000000"/></left>
      <right style="medium"><color rgb="FF000000"/></right>
      <top style="medium"><color rgb="FF000000"/></top>
      <bottom style="medium"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="medium"><color rgb="FF000000"/></left>
      <right style="medium"><color rgb="FF000000"/></right>
      <top style="medium"><color rgb="FF000000"/></top>
      <bottom style="medium"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="medium"><color rgb="FF000000"/></left>
      <right style="medium"><color rgb="FF000000"/></right>
      <top style="medium"><color rgb="FF000000"/></top>
      <bottom style="double"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="medium"><color rgb="FF262626"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="medium"><color rgb="FF262626"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="medium"><color rgb="FF262626"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="medium"><color rgb="FF262626"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="medium"><color rgb="FF262626"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="medium"><color rgb="FF262626"/></right>
      <top style="thin"><color rgb="FF7A7A7A"/></top>
      <bottom style="medium"><color rgb="FF262626"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="medium"><color rgb="FF262626"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="medium"><color rgb="FF262626"/></left>
      <right style="thin"><color rgb="FF7A7A7A"/></right>
      <top style="medium"><color rgb="FF262626"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF7A7A7A"/></left>
      <right style="medium"><color rgb="FF262626"/></right>
      <top style="medium"><color rgb="FF262626"/></top>
      <bottom style="thin"><color rgb="FF7A7A7A"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="27">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="3" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="2" fillId="4" borderId="3" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="1" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="10" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="11" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="12" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="4" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="5" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="6" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="7" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="8" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="9" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="4" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="7" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

export function buildStyledWorkbook(sheets) {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error('At least one worksheet is required.');
  }

  return createZip([
    { name: '[Content_Types].xml', content: buildContentTypes(sheets.length) },
    { name: '_rels/.rels', content: rootRelationships },
    { name: 'xl/workbook.xml', content: buildWorkbook(sheets) },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: buildWorkbookRelationships(sheets.length),
    },
    { name: 'xl/styles.xml', content: styles },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheet.worksheet,
    })),
  ]);
}

export function buildStyledExcel(sheetName, worksheet) {
  return buildStyledWorkbook([{ name: sheetName, worksheet }]);
}

export function buildAssortmentExcel(lot, packets) {
  return buildStyledExcel('Packets', buildWorksheet(lot, packets));
}
