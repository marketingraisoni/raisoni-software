import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlanningFromRows,
  extractPacketIdentity,
} from "../src/services/semiPolishPlanningExcelService.js";

const headers = {
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

test("planning packet identity ignores the bracket grade and matches numeric packet number", () => {
  assert.deepEqual(extractPacketIdentity("UN-9A(A)"), {
    rawPacketLabel: "UN-9A(A)",
    planningGrade: "A",
    packetNumber: 9,
  });
  assert.equal(extractPacketIdentity("UN-105A(C)").packetNumber, 105);
});

test("planning rows are grouped into packets and preserve every polished piece", () => {
  const result = buildPlanningFromRows([
    { rowNumber: 2, values: headers },
    {
      rowNumber: 3,
      values: {
        P: "NEVD-UN/10",
        Q: "UN-9A(A)",
        R: "16.58",
        S: "14",
        T: "1",
        U: "1",
        V: "2.08",
        W: "F-OVAL",
        X: "IGI",
        Y: "F",
        Z: "VS1",
        AB: "6.24",
        AC: "0.38",
      },
    },
    {
      rowNumber: 4,
      values: { U: "1", V: "2.08", W: "F-OVAL", X: "IGI", Y: "F", Z: "VS1" },
    },
    {
      rowNumber: 5,
      values: { U: "1", V: "2.08", W: "F-OVAL", X: "IGI", Y: "F", Z: "VS1" },
    },
    {
      rowNumber: 6,
      values: {
        P: "NEVD-UN/11",
        Q: "UN-10A(B)",
        R: "10.00",
        S: "19",
        T: "1",
        U: "2",
        V: "3.5",
        W: "ROUND",
        X: "IGI",
        Y: "G",
        Z: "VS2",
        AB: "3.5",
        AC: "0.35",
      },
    },
  ]);

  assert.equal(result.packetCount, 2);
  assert.equal(result.plannedPieceCount, 4);
  assert.equal(result.planningRoughCarat, 26.58);
  assert.equal(result.plannedPolishedCarat, 9.74);
  assert.equal(result.packetPlans[0].packetNumber, 9);
  assert.equal(result.packetPlans[0].planningGrade, "A");
  assert.equal(result.packetPlans[0].plannedPieceCount, 3);
  assert.equal(result.packetPlans[0].plannedPolishedCarat, 6.24);
  assert.equal(result.packetPlans[0].pieces[2].sourceRow, 5);
});

test("planning parser rejects duplicate numeric packet numbers", () => {
  assert.throws(
    () =>
      buildPlanningFromRows([
        { rowNumber: 2, values: headers },
        { rowNumber: 3, values: { Q: "UN-9A(A)", R: "1", V: "0.4" } },
        { rowNumber: 4, values: { Q: "OTHER-9A(C)", R: "1", V: "0.3" } },
      ]),
    /Duplicate packet numbers/,
  );
});

test("planning parser rejects changed workbook headers", () => {
  assert.throws(
    () =>
      buildPlanningFromRows([
        { rowNumber: 2, values: { ...headers, Q: "PACKET" } },
        { rowNumber: 3, values: { Q: "UN-9A(A)", R: "1", V: "0.4" } },
      ]),
    /header columns: Q/,
  );
});
