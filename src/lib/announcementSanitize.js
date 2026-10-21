import createDOMPurify from "dompurify";

let dompurify = null;

/**
 * DOMPurify needs a DOM. In the browser `window` is a global; in the Node test
 * runner a jsdom window is injected before this is first used (see
 * announcementSanitize.test.js). The instance is created lazily so importing
 * this module never requires a DOM.
 */
function getDOMPurify() {
  if (!dompurify) {
    dompurify = createDOMPurify(globalThis.window);
  }
  return dompurify;
}

/**
 * Sanitize a rich-text announcement body before it is rendered with
 * dangerouslySetInnerHTML. Only a safe HTML profile is allowed, so scripts,
 * event handlers and other active content are removed.
 */
export function sanitizeAnnouncementHtml(html) {
  return getDOMPurify().sanitize(String(html ?? ""), {
    USE_PROFILES: { html: true },
  });
}

/**
 * Extract visible text from an announcement body without ever writing markup
 * into the DOM (no innerHTML / no HTML parsing), which keeps the widget free of
 * any DOM-based XSS sink.
 */
export function plainTextFromHtml(html) {
  const value = String(html ?? "");
  if (!/[<>]/.test(value)) return value;

  return value
    .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
