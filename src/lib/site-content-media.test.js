import test from "node:test";
import assert from "node:assert/strict";
import { siteContentMediaUrl } from "./site-content-media.js";

test("site content image paths resolve whether stored as public paths or storage paths", () => {
  assert.equal(siteContentMediaUrl("public/assets/portfolio/shopero.webp"), "https://flowsee.ir/assets/portfolio/shopero.webp");
  assert.equal(siteContentMediaUrl("storage/case-studies/shopero.webp"), "https://flowsee.ir/storage/case-studies/shopero.webp");
  assert.equal(siteContentMediaUrl("case-studies/shopero.webp"), "https://flowsee.ir/storage/case-studies/shopero.webp");
  assert.equal(siteContentMediaUrl("storage/app/public/case-studies/shopero.webp"), "https://flowsee.ir/storage/case-studies/shopero.webp");
  assert.equal(siteContentMediaUrl("/public/assets/portfolio-imgShopero1.png"), "https://flowsee.ir/assets/portfolio-imgShopero1.png");
  assert.equal(siteContentMediaUrl("http://flowsee.ir/storage/case-studies/shopero.webp"), "https://flowsee.ir/storage/case-studies/shopero.webp");
  assert.equal(siteContentMediaUrl("http://www.flowsee.ir/public/assets/portfolio-imgShopero1.png?size=large"), "https://flowsee.ir/assets/portfolio-imgShopero1.png?size=large");
  assert.equal(siteContentMediaUrl("http://flowsee.ir/storage/app/public/case-studies/shopero.webp"), "https://flowsee.ir/storage/case-studies/shopero.webp");
  assert.equal(siteContentMediaUrl("16.jpg"), "https://flowsee.ir/16.jpg");
  assert.equal(siteContentMediaUrl("https://cdn.example.test/shopero.webp"), "https://cdn.example.test/shopero.webp");
});
