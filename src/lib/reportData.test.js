import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyFinancialData } from "./reportData.js";

test("weekly report buckets records without a valid Jalali day safely", () => {
  const data = buildWeeklyFinancialData(
    [{ amount: 1 }, { date: "1405/07/00", amount: 2 }, { date: "1405/07/19", amount: "3" }],
    [{ date: "1405/07/31", amount: 4 }, { date: "not-a-date", amount: 5 }]
  );

  assert.equal(data.length, 5);
  assert.equal(data[0].هزینه, 0);
  assert.equal(data[2].هزینه, 3);
  assert.equal(data[3].درآمد, 4);
  assert.deepEqual(data[4], { name: "بدون تاریخ", هزینه: 3, درآمد: 5 });
});

test("weekly report returns four empty buckets for an empty dataset", () => {
  const data = buildWeeklyFinancialData();
  assert.equal(data.length, 4);
  assert.ok(data.every((week) => week.هزینه === 0 && week.درآمد === 0));
});
