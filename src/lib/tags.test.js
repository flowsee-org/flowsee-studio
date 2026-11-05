import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TAGS, getCachedTags, persistNewTag, subscribeToTags } from "./tags.js";

test("DEFAULT_TAGS includes baseline Persian tags", () => {
  assert.ok(DEFAULT_TAGS.includes("طراحی"));
  assert.ok(DEFAULT_TAGS.includes("توسعه"));
  assert.ok(DEFAULT_TAGS.includes("فوری"));
});

test("getCachedTags returns baseline tags in node environment", () => {
  const tags = getCachedTags();
  assert.ok(Array.isArray(tags));
  assert.ok(tags.length >= DEFAULT_TAGS.length);
  assert.ok(tags.includes("توسعه"));
});

test("persistNewTag handles normalization and ignores empty string", async () => {
  const before = getCachedTags().length;
  const same = await persistNewTag("   ");
  assert.equal(same.length, before);

  let notified = null;
  const unsub = subscribeToTags((updated) => {
    notified = updated;
  });

  const next = await persistNewTag("  بک‌اند جدید  ");
  assert.ok(next.includes("بک‌اند جدید"));
  unsub();
});

