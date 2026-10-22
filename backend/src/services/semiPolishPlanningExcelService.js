import { inflateRawSync } from "node:zlib";

const REQUIRED_HEADERS = {
  P: "LOT NO",
  Q: "VRIDDHI LOT NO.",
  R: "R.WT.",
  S: "CK-ID",
  T: "SR.NO",
  U: "SR.NO",
  V: "POL CTS.",
  W: "SHAPE",
  X: "CUT",
  Y: "COLOR",
  Z: "CLARITY",
  AA: "LS",
  AB: "SUM_P.CTS",
  AC: "Y%",
};

function roundCarat(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function decodeXml(value = "") {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    );
}

function getAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error("The uploaded file is not a valid Excel workbook.");
  }

  let endOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0)
    throw new Error("The uploaded Excel ZIP directory is invalid.");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("The uploaded Excel file contains an invalid ZIP entry.");
    }
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8")
      .replace(/\\/g, "/");

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(
        "The uploaded Excel file contains an invalid local ZIP entry.",
      );
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset =
      localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

    let contents;
    if (compressionMethod === 0) contents = compressed;
    else if (compressionMethod === 8) contents = inflateRawSync(compressed);
    else
      throw new Error(
        `Unsupported Excel compression method: ${compressionMethod}`,
      );

    entries.set(fileName, contents);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function requireEntry(entries, name) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Excel workbook is missing ${name}.`);
  return entry.toString("utf8");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const result = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    const text = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map((part) => decodeXml(part[1]))
      .join("");
    result.push(text);
  }
  return result;
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)) {
    const rowNumber = Number(getAttribute(rowMatch[1], "r"));
    const values = {};
    for (const cellMatch of rowMatch[2].matchAll(
      /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/gi,
    )) {
      const attributes = cellMatch[1] || cellMatch[2] || "";
      const body = cellMatch[3] || "";
      const reference = getAttribute(attributes, "r");
      const column = reference.replace(/\d+/g, "");
      const type = getAttribute(attributes, "t");
      const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
      const inlineMatches = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)];
      let value = null;

      if (type === "s" && valueMatch)
        value = sharedStrings[Number(valueMatch[1])] ?? "";
      else if (type === "inlineStr")
        value = inlineMatches.map((item) => decodeXml(item[1])).join("");
      else if (type === "b" && valueMatch) value = valueMatch[1] === "1";
      else if (valueMatch) value = decodeXml(valueMatch[1]);

      if (value !== null) values[column] = value;
    }
    rows.push({ rowNumber, values });
  }
  return rows;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function extractPacketIdentity(rawValue) {
  const rawPacketLabel = String(rawValue ?? "")
    .trim()
    .toUpperCase();
  const planningGrade =
    rawPacketLabel.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() ?? "";
  const withoutBracketGrade = rawPacketLabel.replace(/\s*\([^()]+\)\s*$/, "");
  const numberMatch = withoutBracketGrade.match(/(\d+)(?!.*\d)/);
  return {
    rawPacketLabel,
    planningGrade,
    packetNumber: numberMatch ? Number(numberMatch[1]) : null,
  };
}

export function buildPlanningFromRows(rows) {
  const headerRow = rows.find((row) => row.rowNumber === 2);
  if (!headerRow) throw new Error("The FILE sheet is missing its header row.");

  const invalidHeaders = Object.entries(REQUIRED_HEADERS).filter(
    ([column, expected]) =>
      normalizeHeader(headerRow.values[column]) !== expected,
  );
  if (invalidHeaders.length) {
    const columns = invalidHeaders
      .map(
        ([column, expected]) =>
          `${column} (expected "${expected}", found "${normalizeHeader(headerRow.values[column])}")`,
      )
      .join(", ");
    throw new Error(
      `The FILE sheet format is invalid. Check header columns: ${columns}. Available columns: ${Object.keys(headerRow.values).join(", ")}.`,
    );
  }

  const packetPlans = [];
  let current = null;

  for (const row of rows.filter((item) => item.rowNumber >= 3)) {
    const rawPacket = String(row.values.Q ?? "").trim();
    if (rawPacket && rawPacket !== "0") {
      if (current) packetPlans.push(current);
      const identity = extractPacketIdentity(rawPacket);
      if (!identity.packetNumber) {
        throw new Error(
          `Unable to read the packet number in FILE!Q${row.rowNumber}.`,
        );
      }
      current = {
        ...identity,
        planningLotNo: String(row.values.P ?? "").trim(),
        roughCarat: roundCarat(numberOrNull(row.values.R)),
        checkerId: String(row.values.S ?? "").trim(),
        sourceSerial: numberOrNull(row.values.T),
        planningSerial: numberOrNull(row.values.U),
        sourceStartRow: row.rowNumber,
        pieces: [],
      };
    }

    const polishedCarat = numberOrNull(row.values.V);
    if (polishedCarat !== null && polishedCarat > 0) {
      if (!current) {
        throw new Error(
          `FILE!V${row.rowNumber} contains planning data before a packet number.`,
        );
      }
      current.pieces.push({
        pieceNumber: current.pieces.length + 1,
        sourceRow: row.rowNumber,
        planningSerial: numberOrNull(row.values.U) ?? current.planningSerial,
        polishedCarat: roundCarat(polishedCarat),
        shape: String(row.values.W ?? "")
          .trim()
          .toUpperCase(),
        cut: String(row.values.X ?? "")
          .trim()
          .toUpperCase(),
        color: String(row.values.Y ?? "")
          .trim()
          .toUpperCase(),
        clarity: String(row.values.Z ?? "")
          .trim()
          .toUpperCase(),
        ls: String(row.values.AA ?? "")
          .trim()
          .toUpperCase(),
      });
    }
  }
  if (current) packetPlans.push(current);

  const populatedPlans = packetPlans.filter((plan) => plan.pieces.length > 0);
  if (!populatedPlans.length)
    throw new Error("No packet planning rows were found in the FILE sheet.");

  for (const plan of populatedPlans) {
    plan.plannedPieceCount = plan.pieces.length;
    plan.plannedPolishedCarat = roundCarat(
      plan.pieces.reduce((total, piece) => total + piece.polishedCarat, 0),
    );
    plan.yieldPercentage =
      plan.roughCarat > 0
        ? Math.round((plan.plannedPolishedCarat / plan.roughCarat) * 10_000) /
          100
        : 0;
  }

  const packetNumbers = populatedPlans.map((plan) => plan.packetNumber);
  const duplicatePacketNumbers = [
    ...new Set(
      packetNumbers.filter(
        (number, index) => packetNumbers.indexOf(number) !== index,
      ),
    ),
  ];
  if (duplicatePacketNumbers.length) {
    throw new Error(
      `Duplicate packet numbers in planning file: ${duplicatePacketNumbers.join(", ")}.`,
    );
  }

  const planningRoughCarat = roundCarat(
    populatedPlans.reduce((total, plan) => total + plan.roughCarat, 0),
  );
  const plannedPolishedCarat = roundCarat(
    populatedPlans.reduce(
      (total, plan) => total + plan.plannedPolishedCarat,
      0,
    ),
  );

  return {
    sheetName: "FILE",
    packetPlans: populatedPlans,
    packetCount: populatedPlans.length,
    plannedPieceCount: populatedPlans.reduce(
      (total, plan) => total + plan.plannedPieceCount,
      0,
    ),
    planningRoughCarat,
    plannedPolishedCarat,
    plannedYieldPercentage:
      planningRoughCarat > 0
        ? Math.round((plannedPolishedCarat / planningRoughCarat) * 10_000) / 100
        : 0,
  };
}

export function parsePlanningWorkbook(buffer) {
  const entries = readZipEntries(buffer);
  const workbookXml = requireEntry(entries, "xl/workbook.xml");
  const relationshipsXml = requireEntry(entries, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(
    entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "",
  );

  const relationshipTargets = new Map();
  for (const match of relationshipsXml.matchAll(
    /<Relationship\b([^>]*)\/?\s*>/gi,
  )) {
    relationshipTargets.set(
      getAttribute(match[1], "Id"),
      getAttribute(match[1], "Target"),
    );
  }

  let fileRelationshipId = "";
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)) {
    if (getAttribute(match[1], "name").trim().toUpperCase() === "FILE") {
      fileRelationshipId = getAttribute(match[1], "r:id");
      break;
    }
  }
  if (!fileRelationshipId)
    throw new Error("The workbook does not contain a FILE sheet.");

  let sheetTarget = relationshipTargets.get(fileRelationshipId);
  if (!sheetTarget) throw new Error("The FILE sheet relationship is missing.");
  sheetTarget = sheetTarget.replace(/\\/g, "/").replace(/^\//, "");
  if (!sheetTarget.startsWith("xl/")) sheetTarget = `xl/${sheetTarget}`;

  const sheetXml = requireEntry(entries, sheetTarget);
  return buildPlanningFromRows(parseSheetRows(sheetXml, sharedStrings));
}
