#!/usr/bin/env node

// Auto-Blog Writer for flowsee.ir
// Uses OpenAI to generate Persian/Farsi blog posts and publishes them
// via the blog REST API at https://flowsee.ir/api/studio/site-content/blog
//
// Usage:
//   1. Login to flowsee.ir Studio in your browser
//   2. Open DevTools -> Application -> Local Storage -> copy base44_access_token
//   3. Set your OpenAI key:  export OPENAI_API_KEY=sk-...
//   4. Run:                  node auto-blog-writer.mjs
//
// The script will prompt for the token, generate a post with AI, show you a
// preview, and ask whether to publish immediately or save as a draft.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { OpenAI } from "openai";

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE = "https://flowsee.ir/api/studio/site-content/blog";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MIN_POST_LENGTH = 500; // minimum characters of Persian body text
const DEFAULT_WORD_TARGET = 800; // target word count for the article body

// ─── Persian → Latin slug map (matches the frontend) ─────────────────────────

const PERSIAN_TO_LATIN = {
  ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch",
  ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s",
  ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f",
  ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h",
  ی: "y", ء: "", ئ: "y", ؤ: "v", ي: "y", ك: "k",
};

function slugify(value) {
  return value
    .toLowerCase()
    .split("")
    .map((char) => PERSIAN_TO_LATIN[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createReadline() {
  return readline.createInterface({ input: stdin, output: stdout });
}

function ask(rl, question) {
  return rl.question(question);
}

function info(label, value) {
  console.log(`  ${label.padEnd(16)} ${value}`);
}

function separator() {
  console.log("─".repeat(64));
}

// ─── API layer ────────────────────────────────────────────────────────────────

async function apiFetch(token, path = "", options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const firstError = Object.values(result.errors || {}).flat()[0];
    throw new Error(
      firstError ||
        result.message ||
        (response.status === 401
          ? "نشست منقضی شده — دوباره وارد شوید و توکن تازه بگیرید."
          : `خطای سرور (${response.status})`)
    );
  }
  return result;
}

// ─── AI content generation ───────────────────────────────────────────────────

const TOPIC_GENERATION_PROMPT = `You are a content strategist for Flowsee (flowsee.ir),
a Persian-language business management platform that helps teams with project management,
task tracking, HR, meetings, accounting, and productivity.

Generate ONE fresh, specific blog topic in Persian (Farsi) that would be valuable
for Flowsee's audience: team managers, project leads, HR professionals, and small-to-medium
business owners in Iran.

Rules:
- Output ONLY the topic title in Persian, nothing else.
- Make it specific and actionable (not generic like "مدیریت پروژه چیست؟").
- Draw from real-world pain points: delegation, burnout, reporting, remote team
  management, performance reviews, workflow automation, etc.
- Avoid topics that are purely technical/tutorial (e.g., "how to code in Python").
- Keep it under 15 words.
- Do NOT include any English words unless they are widely used in Persian business
  vocabulary (like "اتوماسیون" or "وورک‌فلو").
- Respond with just the title, no quotes, no numbering.`;

const POST_GENERATION_PROMPT = (topic, categoryName, wordTarget) => `You are an expert Persian (Farsi) content writer for Flowsee,
a business management platform at flowsee.ir.

Write a complete, high-quality blog post about: «${topic}»

The post is for the blog category: «${categoryName}»

REQUIREMENTS:
1. Write ENTIRELY in Persian (Farsi) — natural, fluent, professional tone.
2. Target length: approximately ${wordTarget} words.
3. Structure the article with proper HTML formatting:
   - Use <h2> for major section headings
   - Use <h3> for sub-headings
   - Use <p> for paragraphs
   - Use <ul> and <li> for bullet lists where appropriate
   - Use <strong> for emphasis on key points
   - Use <blockquote> for notable quotes or key takeaways
   - Write in RTL-compatible HTML
4. Content guidelines:
   - Hook the reader in the first 2-3 sentences
   - Provide actionable advice, not just theory
   - Include real-world examples or scenarios
   - Reference how a tool like Flowsee can help (but don't make it a sales pitch)
   - End with a clear conclusion and actionable next steps
5. Do NOT include any English words in the body text (except universally used
   Persian transliterations like "اتوماسیون").
6. Do NOT include markdown syntax — output pure HTML.

OUTPUT FORMAT — you must output EXACTLY these two sections with nothing else:

===EXCERPT===
(A 1-2 sentence summary in Persian, under 200 characters, that would make someone
want to click and read the full article)

===META_TITLE===
(A SEO-optimized title in Persian, 50-65 characters)

===META_DESCRIPTION===
(A SEO meta description in Persian, 140-160 characters)

===CONTENT===
(The full HTML article body as described above, starting with <h2> and ending with </p>)`;

async function generateTopic(openai) {
  console.log("\n🤖 در حال تولید موضوع توسط AI...");
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: TOPIC_GENERATION_PROMPT }],
    max_tokens: 100,
    temperature: 0.8,
  });
  return completion.choices[0].message.content.trim();
}

async function generatePost(openai, topic, categoryName) {
  console.log("✍️  در حال نوشتن مقاله توسط AI...\n");
  const prompt = POST_GENERATION_PROMPT(topic, categoryName, DEFAULT_WORD_TARGET);

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4000,
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content;

  // Parse the structured output
  const excerptMatch = raw.match(/===EXCERPT===\s*([\s\S]*?)(?====|$)/);
  const metaTitleMatch = raw.match(/===META_TITLE===\s*([\s\S]*?)(?====|$)/);
  const metaDescMatch = raw.match(/===META_DESCRIPTION===\s*([\s\S]*?)(?====|$)/);
  const contentMatch = raw.match(/===CONTENT===\s*([\s\S]*)$/);

  return {
    excerpt: excerptMatch?.[1]?.trim() || "",
    meta_title: metaTitleMatch?.[1]?.trim() || topic,
    meta_description: metaDescMatch?.[1]?.trim() || "",
    content: contentMatch?.[1]?.trim() || "",
  };
}

// ─── Preview & confirmation ──────────────────────────────────────────────────

function showPreview(post, category, topic) {
  separator();
  console.log("\n📝 پیش‌نمایش مقاله\n");
  separator();
  console.log(`\n  عنوان:       ${post.meta_title || topic}`);
  console.log(`  دسته‌بندی:   ${category.name}`);
  console.log(`  Slug:        ${post.slug}`);
  console.log(`  خلاصه:       ${post.excerpt || "(ندارد)"}`);
  console.log(`  متن سئو:    ${post.meta_title || "(ندارد)"}`);
  console.log(`  توضیحات سئو: ${post.meta_description || "(ندارد)"}`);
  console.log(`  طول محتوا:  ${post.content?.length || 0} کاراکتر`);
  separator();

  if (post.content) {
    const textPreview = post.content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    console.log(`\n  نمونه متن:\n  ${textPreview}...`);
  }
  separator();
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║          ✍️   Auto-Blog Writer — flowsee.ir              ║
║          AI-powered Persian blog publisher              ║
╚══════════════════════════════════════════════════════════╝
`);

  // 1. Get OpenAI key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("❌ متغیر محیطی OPENAI_API_KEY تنظیم نشده است.");
    console.error("   اجرا کنید: export OPENAI_API_KEY=sk-...\n");
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: openaiKey });

  // 2. Get Bearer token
  const rl = createReadline();
  console.log("🔑 برای دریافت توکن:");
  console.log("   1. در مرورگر به flowsee.ir وارد شوید");
  console.log("   2. DevTools → Application → Local Storage");
  console.log("   3. مقدار base44_access_token را کپی کنید\n");

  const token = (
    await ask(rl, "Bearer token: ")
  ).trim();

  if (!token) {
    console.error("❌ توکن خالی است.");
    rl.close();
    process.exit(1);
  }

  // 3. Fetch categories
  console.log("\n📂 دریافت دسته‌بندی‌ها...");
  let categories;
  try {
    const result = await apiFetch(token);
    categories = result.categories || [];
  } catch (err) {
    console.error(`❌ خطا در ارتباط با سرور: ${err.message}`);
    rl.close();
    process.exit(1);
  }

  if (categories.length === 0) {
    console.error("❌ دسته‌بندی‌ای پیدا نشد. ابتدا از پنل استودیو دسته بسازید.");
    rl.close();
    process.exit(1);
  }

  console.log(`   ${categories.length} دسته یافت شد.`);
  categories.forEach((c, i) => console.log(`   ${i + 1}. ${c.name}`));

  // 4. Generate topic
  let topic;
  try {
    topic = await generateTopic(openai);
  } catch (err) {
    console.error(`❌ خطا در تولید موضوع: ${err.message}`);
    rl.close();
    process.exit(1);
  }

  console.log(`\n📌 موضوع پیشنهادی: ${topic}`);

  // 5. Choose category
  const catIndex = parseInt(
    await ask(rl, `\nشماره دسته‌بندی (1-${categories.length}): `),
    10
  );
  const category = categories[catIndex - 1];
  if (!category) {
    console.error("❌ دسته‌بندی نامعتبر.");
    rl.close();
    process.exit(1);
  }
  console.log(`   انتخاب: ${category.name}`);

  // 6. Generate post
  let post;
  try {
    post = await generatePost(openai, topic, category.name);
  } catch (err) {
    console.error(`❌ خطا در تولید محتوا: ${err.message}`);
    rl.close();
    process.exit(1);
  }

  // Validate
  if (!post.content || post.content.length < MIN_POST_LENGTH) {
    console.error("❌ محتوای تولیدشده بیش‌ازحد کوتاه است. دوباره تلاش کنید.");
    rl.close();
    process.exit(1);
  }

  // Build slug
  post.slug = slugify(post.meta_title || topic);

  // 7. Preview
  showPreview(post, category, topic);

  // 8. Confirm publish
  const publishAnswer = (
    await ask(rl, "\n📤 انتشار فوری یا ذخیره پیش‌نویس؟ (p=انتشار, d=پیش‌نویس): ")
  )
    .trim()
    .toLowerCase();

  const isPublished = publishAnswer === "p" || publishAnswer === "publish";

  // 9. Submit
  const payload = {
    blog_category_id: Number(category.id),
    title: post.meta_title || topic,
    slug: post.slug,
    excerpt: post.excerpt || "",
    content: post.content,
    cover_image: "",
    cover_alt: "",
    meta_title: post.meta_title || "",
    meta_description: post.meta_description || "",
    is_featured: false,
    is_published: isPublished,
    published_at: isPublished ? new Date().toISOString() : null,
  };

  console.log("\n📨 ارسال به سرور...");
  try {
    const result = await apiFetch(token, "", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    console.log(`\n✅ ${isPublished ? "مقاله منتشر شد" : "پیش‌نویس ذخیره شد"}!`);
    console.log(`   شناسه: ${result.id}`);
    if (isPublished) {
      console.log(`   لینک: https://flowsee.ir/blog/${post.slug}`);
    }
  } catch (err) {
    console.error(`❌ خطا در ذخیره: ${err.message}`);
    console.error("\nآیا می‌خواهید محتوای تولیدشده را در فایل ذخیره کنید؟ (y/n)");
    const saveAnswer = (await ask(rl, "")).trim().toLowerCase();
    if (saveAnswer === "y" || saveAnswer === "yes") {
      const { writeFileSync } = await import("node:fs");
      const filename = `draft-${post.slug}.json`;
      writeFileSync(filename, JSON.stringify(payload, null, 2), "utf8");
      console.log(`💾 ذخیره شد: ${filename}`);
    }
  }

  rl.close();
  console.log("\n✨ پایان.\n");
}

main().catch((err) => {
  console.error("خطای غیرمنتظره:", err);
  process.exit(1);
});
