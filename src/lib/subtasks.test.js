import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSubtask, normalizeSubtasks, getSubtaskStats } from "./subtasks.js";

test("normalizeSubtask handles strings, legacy objects, and standard subtask objects", () => {
  const fromString = normalizeSubtask("بررسی اولیه", 0);
  assert.equal(fromString.title, "بررسی اولیه");
  assert.equal(fromString.done, false);
  assert.ok(fromString.id);

  const fromLegacy = normalizeSubtask({ name: "تست کنترل کیفیت", completed: true }, 1);
  assert.equal(fromLegacy.title, "تست کنترل کیفیت");
  assert.equal(fromLegacy.done, true);

  const fromStandard = normalizeSubtask({ id: "custom-1", title: "طراحی پوستر", done: true }, 2);
  assert.equal(fromStandard.id, "custom-1");
  assert.equal(fromStandard.title, "طراحی پوستر");
  assert.equal(fromStandard.done, true);
});

test("normalizeSubtasks parses json strings, comma/newline separated text, and arrays", () => {
  assert.deepEqual(normalizeSubtasks(null), []);
  assert.deepEqual(normalizeSubtasks(""), []);

  const fromJson = normalizeSubtasks(JSON.stringify([{ title: "مرحله ۱", done: false }]));
  assert.equal(fromJson.length, 1);
  assert.equal(fromJson[0].title, "مرحله ۱");

  const fromNewlines = normalizeSubtasks("مورد اول\nمورد دوم");
  assert.equal(fromNewlines.length, 2);
  assert.equal(fromNewlines[0].title, "مورد اول");
  assert.equal(fromNewlines[1].title, "مورد دوم");

  const fromArrayOfStrings = normalizeSubtasks(["زیرتسک یک", "زیرتسک دو"]);
  assert.equal(fromArrayOfStrings.length, 2);
  assert.equal(fromArrayOfStrings[0].title, "زیرتسک یک");
  assert.equal(fromArrayOfStrings[0].done, false);
});

test("getSubtaskStats calculates totals, done count, and completion percent correctly", () => {
  const empty = getSubtaskStats([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.completed, 0);
  assert.equal(empty.percent, 0);
  assert.equal(empty.hasSubtasks, false);
  assert.equal(empty.allDone, false);

  const partial = getSubtaskStats([
    { title: "۱", done: true },
    { title: "۲", done: false },
    { title: "۳", done: true },
    { title: "۴", done: false },
  ]);
  assert.equal(partial.total, 4);
  assert.equal(partial.completed, 2);
  assert.equal(partial.percent, 50);
  assert.equal(partial.hasSubtasks, true);
  assert.equal(partial.allDone, false);

  const allDone = getSubtaskStats([
    { title: "۱", done: true },
    { title: "۲", done: true },
  ]);
  assert.equal(allDone.total, 2);
  assert.equal(allDone.completed, 2);
  assert.equal(allDone.percent, 100);
  assert.equal(allDone.allDone, true);
});

