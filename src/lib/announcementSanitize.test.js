import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// DOMPurify needs a DOM. Inject a jsdom window before importing the sanitizer
// so it binds to a real document instead of Node's global scope.
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { sanitizeAnnouncementHtml, plainTextFromHtml } = await import("./announcementSanitize.js");

test("sanitizeAnnouncementHtml neutralizes the event-handler XSS payload", () => {
  const clean = sanitizeAnnouncementHtml('<img src=x onerror=alert(1)>');

  assert.ok(!/onerror/i.test(clean), "the onerror handler must be removed");
  assert.ok(!/alert\(1\)/i.test(clean), "the script payload must be removed");
  assert.ok(!/<script/i.test(clean), "script tags must not survive");
});

test("sanitizeAnnouncementHtml strips script tags but keeps safe markup", () => {
  const clean = sanitizeAnnouncementHtml("<p>Hello</p><script>alert(document.cookie)</script>");

  assert.equal(clean, "<p>Hello</p>");
});

test("sanitizeAnnouncementHtml removes javascript: urls", () => {
  const clean = sanitizeAnnouncementHtml('<a href="javascript:alert(1)">click</a>');

  assert.ok(!/javascript:/i.test(clean), "javascript: urls must be removed");
});

test("plainTextFromHtml extracts text without writing markup into the DOM", () => {
  assert.equal(plainTextFromHtml('<img src=x onerror=alert(1)>'), "");
  assert.equal(plainTextFromHtml("<p>Hello <b>world</b></p>"), "Hello world");
  assert.equal(plainTextFromHtml("<script>alert(1)</script>Text"), "Text");
  assert.equal(plainTextFromHtml("<p>a &amp; b</p>"), "a & b");
});

test("plainTextFromHtml never creates DOM elements", () => {
  const created = [];
  const original = globalThis.document.createElement;
  globalThis.document.createElement = (...args) => {
    created.push(args[0]);
    return original.apply(globalThis.document, args);
  };

  try {
    plainTextFromHtml('<img src=x onerror=alert(1)>');
  } finally {
    globalThis.document.createElement = original;
  }

  assert.deepEqual(created, []);
});
