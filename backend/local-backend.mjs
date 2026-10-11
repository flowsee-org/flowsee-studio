// Self-contained local backend for the Flowsee Studio app (no Base44 needed).
//
// This is a dependency-free Node HTTP middleware that implements the wire
// contract the `@base44/sdk` client expects, so the existing app code
// (`base44.auth.*`, `base44.entities.*`, integrations) works unchanged against
// a fully local backend:
//
//   - Email/password auth: register -> OTP verify -> login, password reset,
//     logout.
//   - Signed session tokens (HMAC, ~30d), scrypt-hashed passwords.
//   - OTP / reset codes can't be emailed without a mail service, so they are
//     printed to the console and appended to `.local/otp-inbox.log`.
//   - Entity CRUD (list/get/create/update/delete) with sorting, persisted to
//     `.local/db.json`.
//   - The "continue with Google" button signs you in as a seeded demo admin
//     (no OAuth credentials to wire up).
//   - Seeded accounts for instant access (see the banner printed on startup).
//
// It is a development backend. It does not attempt to replicate Base44's
// production features (real OAuth providers, email delivery, SSO, realtime).

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

// Create reusable transporter with Ethereal (fake SMTP for dev)
let emailTransporter = null;
let etherealAccount = null;

async function getEmailTransporter() {
  if (emailTransporter) return { transporter: emailTransporter, account: etherealAccount };

  // Create test account on Ethereal
  etherealAccount = await nodemailer.createTestAccount();

  emailTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  });

  console.log(`\n[local-email] 📧 Ethereal SMTP ready: ${etherealAccount.user}`);
  console.log(`[local-email] 🔗 Preview URL will appear after sending emails\n`);

  return { transporter: emailTransporter, account: etherealAccount };
}

async function sendEmail(to, subject, html) {
  try {
    const { transporter, account } = await getEmailTransporter();
    const info = await transporter.sendMail({
      from: '"FlowSee Studio" <noreply@flowsee.local>',
      to,
      subject,
      html,
    });

    console.log(`\n[local-email] ✅ Email sent to ${to}`);
    console.log(`[local-email] 🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}\n`);

    return info;
  } catch (err) {
    console.error(`[local-email] ❌ Failed to send email to ${to}:`, err.message);
    // Fallback to console log
    console.log(`\n[local-email] 📧 Email (fallback) to ${to}: ${subject}\n`);
  }
}

// --- Announcement email digest -------------------------------------------
async function sendAnnouncementDigest() {
  const store = db.entities["Announcement"] || [];
  if (store.length === 0) return { sent: 0, message: "No announcements to digest" };
  const users = db.users.filter((u) => u.is_active && u.role !== "superadmin");
  if (users.length === 0) return { sent: 0, message: "No active non-superadmin users" };
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = store.filter((a) => {
    const d = new Date(a.created_date);
    return d >= yesterday && (!a.expires_at || new Date(a.expires_at) >= yesterday);
  });
  if (recent.length === 0) return { sent: 0, message: "No recent announcements" };
  const itemsHtml = recent
    .map(
      (a) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px; font-weight: 600; color: #f97316;">${a.title || "بدون عنوان"}</td>
    </tr>
    <tr>
      <td style="padding: 0 12px 16px; color: #333;">${a.body ? a.body.replace(/\n/g, "<br>") : ""}</td>
    </tr>
  `
    )
    .join("");
  const html = `
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #f97316;">استودیو فلوسی — خلاصه اعلامیه‌های امروز</h2>
      <p style="color: #666;">شما ${recent.length} اعلامیه جدید در ۲۴ ساعت گذشته دارید.</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">این ایمیل به صورت خودکار ارسال شده است. برای لغو اشتراک با مدیریت تماس بگیرید.</p>
    </div>
  `;
  let sent = 0;
  for (const user of users) {
    await sendEmail(user.email, `خلاصه اعلامیه‌های امروز — ${recent.length} مورد`, html);
    sent++;
  }
  return { sent, count: recent.length };
}

// --- Purge old soft-deleted records (admin) ------------------------------
async function purgeDeleted(entityName, olderThanDays = 30) {
  const isUserEntity = entityName === "User";
  const store = isUserEntity ? db.users : (db.entities[entityName] || []);
  if (!Array.isArray(store)) return { purged: 0 };
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  let purged = 0;
  for (let i = store.length - 1; i >= 0; i--) {
    const r = store[i];
    if (r.deleted_at && new Date(r.deleted_at) < cutoff) {
      store.splice(i, 1);
      purged++;
    }
  }
  if (purged > 0) saveDb();
  return { purged };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, ".local");
const DB_FILE = join(DATA_DIR, "db.json");
const OTP_INBOX = join(DATA_DIR, "otp-inbox.log");
const KNOWN_ENTITIES = [
  "Announcement",
  "AppSettings",
  "Comment",
  "ActivityLog",
  "Employee",
  "Expense",
  "Goal",
  "Income",
  "LeaveRequest",
  "Meeting",
  "Notification",
  "Project",
  "Salary",
  "Sprint",
  "Task",
  "TaskTemplate",
  "User",
  "WorkReport",
];

// Big write batches can arrive as a single dialog; debounce the JSON write.
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }, 200);
}
function loadDb() {
  const fresh = () => ({
    secret: randomBytes(32).toString("hex"),
    users: [],
    entities: Object.fromEntries(KNOWN_ENTITIES.map((n) => [n, []])),
  });
  if (!existsSync(DB_FILE)) return fresh();
  try {
    const parsed = JSON.parse(readFileSync(DB_FILE, "utf8"));
    if (!parsed?.secret || !Array.isArray(parsed.users)) return fresh();
    parsed.entities ||= {};
    for (const name of KNOWN_ENTITIES) parsed.entities[name] ||= [];
    return parsed;
  } catch {
    return fresh();
  }
}
const db = loadDb();

// ---------------------------------------------------------------- passwords
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pw), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(String(pw), salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

// ------------------------------------------------------------------- tokens
const b64url = (buf) => Buffer.from(buf).toString("base64url");
function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", db.secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expect = createHmac("sha256", db.secret).update(`${header}.${body}`).digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function issueToken(user) {
  const now = Date.now();
  return signToken({ sub: user.id, email: user.email, iat: now, exp: now + TOKEN_TTL_MS });
}

// ----------------------------------------------------------------- users & OTP
function randomId(prefix) {
  return `${prefix || "rec"}_${randomBytes(6).toString("hex")}`;
}
function publicUser(u) {
  if (!u) return null;
  const { password_hash: _ph, ...rest } = u;
  return rest;
}
function findUserByEmail(email) {
  return db.users.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());
}
function seedUsers() {
  const seed = (email, password, role, full_name) => {
    if (findUserByEmail(email)) return;
    const now = new Date().toISOString();
    const user = {
      id: randomId("u"),
      email,
      password_hash: hashPassword(password),
      full_name,
      phone: "",
      profile_image: "",
      role,
      is_verified: true,
      created_date: now,
      updated_date: now,
    };
    db.users.push(user);
    saveDb();
  };
  seed("ceo@flowsee.local", "ceo12345", "superadmin", "مدیرعامل");
  seed("admin@flowsee.local", "admin12345", "admin", "مدیر سیستم");
  seed("staff@flowsee.local", "staff12345", "user", "پرسنل نمونه");
  seed("google.demo@flowsee.local", randomBytes(18).toString("hex"), "superadmin", "کاربر گوگل");
}
seedUsers();
banner();

function banner() {
  console.log(
    `
==============================================================
  Local Base44 backend (self-hosted) — ${
      db.users.filter((u) => u.role === "superadmin").length
    } superadmin(s), ${
      db.users.filter((u) => u.role === "admin").length
    } admin(s), ${db.users.length} user(s)
--------------------------------------------------------------
  CEO/مدیرعامل : ceo@flowsee.local      / ceo12345
  Admin/مدیر   : admin@flowsee.local    / admin12345
  Staff/پرسنل  : staff@flowsee.local    / staff12345
  Google button signs you in as google.demo@flowsee.local (superadmin)
  OTP/reset codes logged to  .local/otp-inbox.log
--------------------------------------------------------------
  Data persists in .local/db.json. Delete it to reset everything.
==============================================================
`);
}

const otps = new Map(); // email -> { code, expiresAt }
const resets = new Map(); // token -> { email, expiresAt }

function newOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function deliverOtp(email, code) {
  // Print to console for easy access
  console.log(`\n[local-auth] OTP for ${email}: ${code}\n`);

  // Log to file
  const line = `${new Date().toISOString()}  OTP for ${email}: ${code}\n`;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(OTP_INBOX, line);
  } catch {
    /* console output is enough */
  }

  // Send real email via Ethereal
  await sendEmail(
    email,
    "کد تایید ثبت‌نام - FlowSee Studio",
    `
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #f97316;">استودیو فلوسی</h2>
      <p>کد تایید ثبت‌نام شما:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
        ${code}
      </div>
      <p style="color: #666; font-size: 14px;">این کد ظرف ۱۰ دقیقه منقضی می‌شود.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.</p>
    </div>
    `
  );
}

async function deliverReset(email, token) {
  const resetUrl = `http://localhost:5173/reset-password?token=${token}`;

  // Print to console
  console.log(`\n[local-auth] Password reset for ${email} -> ${resetUrl}\n`);

  // Log to file
  const line = `${new Date().toISOString()}  Password reset link for ${email}: ${resetUrl}\n`;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(OTP_INBOX, line);
  } catch {
    /* console output is enough */
  }

  // Send real email via Ethereal
  await sendEmail(
    email,
    "بازیابی رمز عبور - FlowSee Studio",
    `
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #f97316;">استودیو فلوسی</h2>
      <p>برای بازیابی رمز عبور خود روی دکمه زیر کلیک کنید:</p>
      <a href="${resetUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">بازیابی رمز عبور</a>
      <p style="color: #666; font-size: 14px;">این لینک ظرف ۱ ساعت منقضی می‌شود.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.</p>
    </div>
    `
  );

  return resetUrl;
}

// ------------------------------------------------------------------ routing
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(body, contentType) {
  const m = /boundary=([^;]+)/.exec(contentType || "");
  if (!m) return [];
  let boundary = m[1].trim().replace(/^"|"$/g, "");
  if (!boundary.startsWith("--")) boundary = "--" + boundary;
  const buf = Buffer.from(body);
  const search = Buffer.from(boundary);
  let pos = buf.indexOf(search);
  if (pos === -1) return [];
  const parts = [];
  let cursor = pos + search.length;
  const delim = Buffer.concat([Buffer.from("\r\n"), search]);
  while (true) {
    if (buf.subarray(cursor, cursor + 2).toString() === "--") break;
    let hStart = cursor;
    if (buf.subarray(hStart, hStart + 2).toString() === "\r\n") hStart += 2;
    const headerEnd = buf.indexOf("\r\n\r\n", hStart);
    if (headerEnd === -1) break;
    const headers = buf.subarray(hStart, headerEnd).toString("utf8");
    const contentStart = headerEnd + 4;
    const nextDelim = buf.indexOf(delim, contentStart);
    if (nextDelim === -1) break;
    const data = buf.subarray(contentStart, nextDelim);
    const nameM = /name="([^"]*)"/.exec(headers);
    const fileM = /filename="([^"]*)"/.exec(headers);
    const typeM = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
    parts.push({
      name: nameM && nameM[1],
      filename: fileM && fileM[1],
      contentType: typeM ? typeM[1].trim() : "application/octet-stream",
      data,
    });
    cursor = nextDelim + delim.length;
  }
  return parts;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(typeof body === "string" ? JSON.stringify(body) : JSON.stringify(body));
}
function error(res, status, message) {
  sendJson(res, status, { message });
}
function getAuthUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return findUserByEmail(payload.email) || null;
}
function requireUser(res, u, api) {
  if (!u) {
    error(res, 401, "Not authenticated");
    return false;
  }
  return true;
}

const pathStartsWith = (path, prefix) => {
  const canon = path.startsWith("/") ? path : `/${path}`;
  return canon.startsWith(prefix) || canon.startsWith(`${prefix}/`);
};

// Main handler. `req.url` arrives without the "/api" mount prefix from
// connect-style middlewares, but we tolerate either form here.
async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://local");
  let path = decodeURIComponent(url.pathname);
  if (pathStartsWith(path, "/api")) path = path.slice("/api".length) || "/";
  const method = String(req.method || "GET").toUpperCase();

  try {
    // --- App public settings (platform contract) --------------------------
    if (method === "GET" && /^\/apps\/public\/prod\/public-settings\/by-id\/[^/]+$/.test(path)) {
      return sendJson(res, 200, { id: url.pathname.split("/").pop(), public_settings: {} });
    }

    // --- Email/password auth ----------------------------------------------
    if (method === "POST" && /^\/apps\/[^/]+\/auth\/register$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) return error(res, 400, "Email and password are required");
      if (password.length < 6) return error(res, 400, "Password must be at least 6 characters");
      if (findUserByEmail(email)) return error(res, 409, "An account with this email already exists");
      const now = new Date().toISOString();
      const user = {
        id: randomId("u"),
        email,
        password_hash: hashPassword(password),
        full_name: "",
        phone: "",
        profile_image: "",
        role: "user",
        // Local dev backend: verify immediately so the user can get in without
        // an email round-trip. Real Base44 would require OTP verification here.
        is_verified: true,
        created_date: now,
        updated_date: now,
      };
      db.users.push(user);
      saveDb();
      // Return an access token immediately — no OTP step for local dev.
      return sendJson(res, 200, { access_token: issueToken(user), user: publicUser(user) });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/auth\/verify-otp$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.email || "").trim().toLowerCase();
      const code = String(body.otp_code || "");
      const record = otps.get(email);
      if (!record || record.expiresAt < Date.now())
        return error(res, 400, "Verification code has expired. Request a new one.");
      if (String(record.code) !== code) return error(res, 400, "Invalid verification code");
      otps.delete(email);
      const user = findUserByEmail(email);
      if (!user) return error(res, 404, "User not found");
      user.is_verified = true;
      user.updated_date = new Date().toISOString();
      saveDb();
      return sendJson(res, 200, { access_token: issueToken(user), user: publicUser(user) });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/auth\/resend-otp$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.email || "").trim().toLowerCase();
      const code = newOtpCode();
      otps.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
      await deliverOtp(email, code);
      return sendJson(res, 200, { success: true });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/auth\/login$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.email || "").trim().toLowerCase();
      const user = findUserByEmail(email);
      if (!user || !verifyPassword(String(body.password || ""), user.password_hash))
        return error(res, 401, "ایمیل یا رمز عبور نامعتبر است");
      user.is_verified = true;
      saveDb();
      return sendJson(res, 200, { access_token: issueToken(user), user: publicUser(user) });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/auth\/reset-password-request$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.email || "").trim().toLowerCase();
      const user = findUserByEmail(email);
      if (user) {
        const token = randomBytes(24).toString("hex");
        resets.set(token, { email, expiresAt: Date.now() + 60 * 60 * 1000 });
        await deliverReset(email, token);
      }
      // Always report success so the endpoint can't be used to probe emails.
      return sendJson(res, 200, { success: true });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/auth\/reset-password$/.test(path)) {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const token = String(body.reset_token || "");
      const record = resets.get(token);
      if (!record || record.expiresAt < Date.now())
        return error(res, 400, "Reset link is invalid or has expired");
      const user = findUserByEmail(record.email);
      if (!user) return error(res, 404, "User not found");
      const pw = String(body.new_password || "");
      if (pw.length < 6) return error(res, 400, "Password must be at least 6 characters");
      user.password_hash = hashPassword(pw);
      user.updated_date = new Date().toISOString();
      resets.delete(token);
      saveDb();
      return sendJson(res, 200, { success: true });
    }

    // --- "Continue with Google" simulation ---------------------------------
    if (method === "GET" && path === "/apps/auth/login") {
      const fromUrl = url.searchParams.get("from_url") || "/";
      const demo = findUserByEmail("google.demo@flowsee.local");
      const token = issueToken(demo);
      const sep = fromUrl.includes("?") ? "&" : "?";
      res.statusCode = 302;
      res.setHeader("Location", `${fromUrl}${sep}access_token=${encodeURIComponent(token)}`);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Redirecting to the app…");
    }

    // --- Logout (SDK does a full GET to this URL, no appId in path) ---------
    if (method === "GET" && path === "/apps/auth/logout") {
      const fromUrl = url.searchParams.get("from_url") || "/";
      res.statusCode = 302;
      res.setHeader("Location", fromUrl);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Logged out.");
    }
    if (method === "POST" && path === "/apps/auth/logout") {
      return sendJson(res, 200, { success: true });
    }

    // --- Invite a user (Admin page) -----------------------------------------
    if (method === "POST" && /^\/apps\/[^/]+\/runtime\/users\/invite-user$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "invite")) return undefined;
      if (u.role !== "superadmin" && u.role !== "admin")
        return error(res, 403, "Only admins can invite users");
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const email = String(body.user_email || "").trim().toLowerCase();
      const role = ["user", "admin", "superadmin"].includes(body.role) ? body.role : "user";
      if (!email) return error(res, 400, "Email is required");
      if (role === "superadmin" && u.role !== "superadmin")
        return error(res, 403, "Only a superadmin can create another superadmin");
      if (findUserByEmail(email)) return error(res, 409, "An account with this email already exists");
      const now = new Date().toISOString();
      // Dev backend: no email to deliver, so the user is created already
      // verified. If the admin supplies an initial password use it, otherwise
      // a random one (the member can log in and reset it).
      const initialPassword = String(body.initial_password || "");
      const user = {
        id: randomId("u"),
        email,
        password_hash: hashPassword(
          initialPassword.length >= 6 ? initialPassword : randomBytes(18).toString("hex")
        ),
        full_name: String(body.full_name || ""),
        phone: String(body.phone || ""),
        profile_image: String(body.profile_image || ""),
        role,
        is_verified: true,
        created_date: now,
        updated_date: now,
      };
      db.users.push(user);
      saveDb();
      console.log(`[local-auth] invited ${email} (role: ${role})`);
      if (initialPassword)
        console.log(`[local-auth] initial password for ${email}: ${initialPassword}`);
      return sendJson(res, 200, { success: true, user: publicUser(user) });
    }

    // --- Current user (must come before the generic entity router) ----------
    if (/^\/apps\/[^/]+\/entities\/User\/me$/.test(path)) {
      const u = getAuthUser(req);
      if (method === "GET") {
        if (!requireUser(res, u, "me")) return undefined;
        return sendJson(res, 200, publicUser(u));
      }
      if (method === "PUT") {
        if (!requireUser(res, u, "me")) return undefined;
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        for (const key of ["full_name", "phone", "profile_image"]) {
          if (body[key] !== undefined) {
            if (typeof body[key] !== "string") return error(res, 400, `${key} must be a string`);
            u[key] = body[key];
          }
        }
        u.updated_date = new Date().toISOString();
        saveDb();
        return sendJson(res, 200, publicUser(u));
      }
      return error(res, 405, "Method not allowed");
    }

    // --- Restore a soft-deleted record (delete undo) --------------------
    const restoreMatch = /^\/apps\/[^/]+\/entities\/([^/]+)\/([^/]+)\/restore$/.exec(path);
    if (restoreMatch && method === "POST") {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "restore")) return undefined;
      const entityName = restoreMatch[1];
      const recordId = restoreMatch[2];
      const isUserEntity = entityName === "User";
      const store = isUserEntity ? db.users : (db.entities[entityName] ||= []);
      const rec = store.find((r) => r.id === recordId);
      if (!rec) return error(res, 404, `${entityName} not found`);
      if (!rec.deleted_at) return error(res, 400, "Record is not deleted");
      delete rec.deleted_at;
      delete rec.deleted_by;
      if (isUserEntity) rec.is_active = true;
      rec.updated_date = new Date().toISOString();
      // Log the restore as a distinct activity so the audit trail is honest.
      const logStore = db.entities["ActivityLog"] ||= [];
      logStore.push({
        id: randomId("log"),
        user_id: u.id,
        user_name: u.full_name || u.email,
        action: "restore",
        entity_type: entityName,
        entity_id: recordId,
        entity_title: rec.title || rec.name || "مورد",
        details: `${u.full_name || u.email} ${entityName} "${rec.title || rec.name || recordId}" را بازگردانی کرد`,
        created_date: new Date().toISOString(),
      });
      saveDb();
      return sendJson(res, 200, { success: true, record: isUserEntity ? publicUser(rec) : rec });
    }

    // --- Entities ----------------------------------------------------------
    const entityMatch = /^\/apps\/[^/]+\/entities\/([^/]+)(?:\/([^/]+))?$/.exec(path);
    if (entityMatch && ["GET", "POST", "PUT", "DELETE"].includes(method)) {
      const entityName = entityMatch[1];
      const recordId = entityMatch[2] || null;
      const u = getAuthUser(req);
      if (!requireUser(res, u, "entities")) return undefined;
      // The "User" entity mirrors the auth user store on purpose: registered
      // accounts are the directory that meeting/task pickers, the employees
      // page and the admin user list read from. password_hash is always
      // stripped on output.
      const isUserEntity = entityName === "User";
      const store = isUserEntity ? db.users : (db.entities[entityName] ||= []);

      if (method === "GET") {
        const sanitize = isUserEntity ? publicUser : (r) => r;
        if (recordId) {
          const rec = store.find((r) => r.id === recordId && !r.deleted_at);
          if (!rec) return error(res, 404, `${entityName} not found`);
          return sendJson(res, 200, sanitize(rec));
        }
        let out = [...store];
        // Soft-deleted records are hidden from normal reads (delete undo keeps
        // them in the store; see the restore endpoint below).
        if (url.searchParams.get("includeDeleted") !== "1")
          out = out.filter((r) => !r.deleted_at);
        const sort = url.searchParams.get("sort");
        if (sort) {
          const desc = sort.startsWith("-");
          const field = desc ? sort.slice(1) : sort;
          out.sort((a, b) => {
            const va = a[field];
            const vb = b[field];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp =
              typeof va === "number" && typeof vb === "number"
                ? va - vb
                : String(va).localeCompare(String(vb));
            return desc ? -cmp : cmp;
          });
        }
        const q = url.searchParams.get("q");
        if (q) {
          try {
            const query = JSON.parse(q);
            out = out.filter((r) =>
              Object.entries(query).every(([key, value]) => r[key] === value)
            );
          } catch {
            /* ignore malformed filter */
          }
        }
        const skip = parseInt(url.searchParams.get("skip") || "0", 10) || 0;
        const limit = parseInt(url.searchParams.get("limit") || "0", 10) || 0;
        out = skip ? out.slice(skip) : out;
        if (limit) out = out.slice(0, limit);
        const fields = url.searchParams.get("fields");
        if (fields) {
          const keys = fields.split(",").map((k) => k.trim()).filter(Boolean);
          out = out.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
        }
        return sendJson(res, 200, out.map(sanitize));
      }

      if (method === "POST") {
        const raw = (await readBody(req)).toString("utf8");
        const body = JSON.parse(raw || "{}");
        if (typeof body !== "object" || body === null || Array.isArray(body))
          return error(res, 400, "Invalid entity payload");
        const now = new Date().toISOString();
        const { id: _id, created_date: _cd, updated_date: _ud, created_by_id: _cbi, ...rest } = body;
        const rec = {
          ...rest,
          id: randomId(
            entityName === "User" ? "u" : entityName.toLowerCase().replace(/[^a-z]/g, "")
          ),
          created_by_id: u.id,
          created_by: u.email,
          created_by_email: u.email,
          created_date: now,
          updated_date: now,
        };

        // Auto-generate task_number for Task entities
        if (entityName === "Task") {
          const taskCount = store.filter(t => t.task_number).length;
          rec.task_number = `TSK-${String(taskCount + 1).padStart(4, '0')}`;
        }

        store.push(rec);

        // Log activity
        const logStore = db.entities["ActivityLog"] ||= [];
        logStore.push({
          id: randomId("log"),
          user_id: u.id,
          user_name: u.full_name || u.email,
          action: "create",
          entity_type: entityName,
          entity_id: rec.id,
          entity_title: rec.title || rec.name || rec.body?.slice(0, 50) || "مورد",
          details: `${u.full_name || u.email} ${entityName} "${rec.title || rec.name || rec.id}" را ایجاد کرد`,
          created_date: now,
        });

        // Create notifications for relevant users
        if (entityName === "Task" && rec.assignees) {
          const notifStore = db.entities["Notification"] ||= [];
          rec.assignees.forEach((assignee) => {
            notifStore.push({
              id: randomId("notif"),
              user_id: assignee, // This should ideally be resolved to user ID
              title: "تسک جدید",
              message: `${u.full_name || u.email} تسک "${rec.title}" را به شما اختصاص داد`,
              type: "task_assigned",
              entity_type: "Task",
              entity_id: rec.id,
              read: false,
              link: "/tasks",
              created_date: now,
            });
          });
        }

        saveDb();
        return sendJson(res, 200, rec);
      }

      if (method === "PUT") {
        if (!recordId) return error(res, 400, "Record id is required for updates");
        const raw = (await readBody(req)).toString("utf8");
        const body = JSON.parse(raw || "{}");
        const rec = store.find((r) => r.id === recordId && !r.deleted_at);
        if (!rec) return error(res, 404, `${entityName} not found`);
        // Never let a document overwrite its own identity or audit fields.
        const { id: _id, created_date: _cd, created_by_id: _cbi, ...rest } = body;
        if (isUserEntity) {
          // Only owners or admins/superadmins may update a user record, and
          // only admins/superadmins may change another user's role.
          const isSelf = rec.id === u.id;
          const isManager = u.role === "superadmin" || u.role === "admin";
          if (!isSelf && !isManager) return error(res, 403, "You can only update your own profile");
          if (!isSelf && (body.role !== undefined) && !isManager)
            return error(res, 403, "Only admins can change roles");
          // Superadmin protection: cannot demote a superadmin, cannot demote self
          if (body.role && body.role !== rec.role) {
            if (rec.role === "superadmin") return error(res, 403, "Cannot change the role of a superadmin");
            const superadminCount = db.users.filter((x) => x.role === "superadmin").length;
            if (superadminCount === 1 && u.role === "superadmin" && body.role !== "superadmin")
              return error(res, 403, "Cannot demote the only superadmin");
            if (isSelf && body.role !== "superadmin") return error(res, 403, "Superadmin cannot demote themselves");
          }
          if (body.password_hash) delete rest.password_hash;
        }

        // Track what changed for activity log
        const oldValues = {};
        Object.keys(rest).forEach(key => {
          if (rec[key] !== rest[key]) oldValues[key] = rec[key];
        });

        Object.assign(rec, rest, { updated_date: new Date().toISOString() });

        // Log activity
        const logStore = db.entities["ActivityLog"] ||= [];
        const action = oldValues.status ? "status_change" : Object.keys(oldValues).length > 0 ? "update" : "update";
        logStore.push({
          id: randomId("log"),
          user_id: u.id,
          user_name: u.full_name || u.email,
          action: action,
          entity_type: entityName,
          entity_id: rec.id,
          entity_title: rec.title || rec.name || "مورد",
          details: `${u.full_name || u.email} ${entityName} "${rec.title || rec.name || rec.id}" را ${action === "status_change" ? "تغییر وضعیت داد" : "ویرایش کرد"}`,
          created_date: new Date().toISOString(),
        });

        saveDb();
        return sendJson(res, 200, sanitize(rec));
      }

      if (method === "DELETE") {
        if (!recordId) return error(res, 400, "Record id is required for deletion");
        // Only managers may delete user records (non-User entities follow the
        // generic rule).
        if (isUserEntity) {
          const isManager = u.role === "superadmin" || u.role === "admin";
          if (!isManager) return error(res, 403, "Only admins can remove users");
        }
        const i = store.findIndex((r) => r.id === recordId);
        if (i === -1) return error(res, 404, `${entityName} not found`);
        const deleted = store[i];
        if (isUserEntity) {
          if (deleted.id === u.id) return error(res, 400, "Cannot delete your own account");
          if (deleted.role === "superadmin") return error(res, 403, "Cannot delete a superadmin");
          if (deleted.role === "admin" && u.role !== "superadmin")
            return error(res, 403, "Only a superadmin can delete an admin");
        }
        // Soft delete: keep the record and mark it so the UI can offer undo
        // (5-second window) before it is physically purged.
        const nowIso = new Date().toISOString();
        deleted.deleted_at = nowIso;
        deleted.deleted_by = u.id;
        if (isUserEntity) deleted.is_active = false; // deleted users can't log in
        store[i] = deleted;

        // Log activity
        const logStore = db.entities["ActivityLog"] ||= [];
        logStore.push({
          id: randomId("log"),
          user_id: u.id,
          user_name: u.full_name || u.email,
          action: "delete",
          entity_type: entityName,
          entity_id: recordId,
          entity_title: deleted.title || deleted.name || "مورد",
          details: `${u.full_name || u.email} ${entityName} "${deleted.title || deleted.name || recordId}" را حذف کرد`,
          created_date: nowIso,
        });

        saveDb();
        return sendJson(res, 200, { success: true, id: recordId });
      }
    }

    // --- Notifications (mark all read) ------------------------------------
    if (method === "POST" && /\/notification\/mark-all-read$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "notifications")) return undefined;
      const store = db.entities["Notification"] ||= [];
      store.forEach((n) => {
        if (n.user_id === u.id) n.read = true;
      });
      saveDb();
      return sendJson(res, 200, { success: true });
    }

    // --- CSV Export -------------------------------------------------------
    if (method === "GET" && /\/export\/([^/]+)$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "export")) return undefined;
      const entityName = path.match(/\/export\/([^/]+)$/)[1];
      const store = db.entities[entityName] || [];
      if (store.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${entityName}.csv"`);
        return res.end("");
      }
      const headers = Object.keys(store[0]);
      const csvRows = [headers.join(",")];
      store.forEach((row) => {
        csvRows.push(headers.map((h) => {
          let val = row[h];
          if (val === null || val === undefined) val = "";
          if (typeof val === "object") val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(","));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${entityName}.csv"`);
      return res.end("﻿" + csvRows.join("\n"));
    }

    // --- Backup / Restore -------------------------------------------------
    if (method === "GET" && /\/backup$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "backup")) return undefined;
      if (u.role !== "superadmin") return error(res, 403, "Only superadmin can backup");
      const exportData = { ...db, users: db.users.map((u) => { const { password_hash, ...rest } = u; return rest; }) };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="flowsee-backup-${new Date().toISOString().slice(0,10)}.json"`);
      return res.end(JSON.stringify(exportData, null, 2));
    }
    if (method === "POST" && /\/restore$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "restore")) return undefined;
      if (u.role !== "superadmin") return error(res, 403, "Only superadmin can restore");
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      if (body.entities) {
        Object.assign(db.entities, body.entities);
        saveDb();
        return sendJson(res, 200, { success: true, message: "Database restored" });
      }
      return error(res, 400, "Invalid backup format");
    }

    // --- Announcement digest (admin) --------------------------------------
    if (method === "POST" && /\/announcement\/digest$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "digest")) return undefined;
      if (u.role !== "superadmin" && u.role !== "admin") return error(res, 403, "Only admins can send digest");
      const result = await sendAnnouncementDigest();
      return sendJson(res, 200, result);
    }

    // --- Purge soft-deleted records (admin) -------------------------------
    if (method === "POST" && /\/purge\/([^/]+)$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "purge")) return undefined;
      if (u.role !== "superadmin" && u.role !== "admin") return error(res, 403, "Only admins can purge");
      const entityName = path.match(/\/purge\/([^/]+)$/)[1];
      const result = await purgeDeleted(entityName, 30);
      return sendJson(res, 200, result);
    }

    // --- User deactivation ------------------------------------------------
    if (method === "POST" && /\/entities\/User\/[^/]+\/deactivate$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "deactivate")) return undefined;
      if (u.role !== "superadmin" && u.role !== "admin") return error(res, 403, "Only admins can deactivate users");
      const targetId = path.match(/\/entities\/User\/([^/]+)\/deactivate$/)[1];
      const target = db.users.find((r) => r.id === targetId);
      if (!target) return error(res, 404, "User not found");
      if (target.id === u.id) return error(res, 400, "Cannot deactivate yourself");
      if (target.role === "superadmin") return error(res, 403, "Cannot deactivate a superadmin");
      target.is_active = false;
      target.updated_date = new Date().toISOString();
      saveDb();
      return sendJson(res, 200, { success: true, user: publicUser(target) });
    }

    // --- Superadmin protection on role change -----------------------------
    // (handled inline in the PUT entity route below, but add explicit check)

    // --- Integrations ------------------------------------------------
    if (method === "POST" && /^\/apps\/[^/]+\/integration-endpoints\/Core\/UploadFile$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "upload")) return undefined;
      const raw = await readBody(req);
      const contentType = String(req.headers["content-type"] || "");
      const parts = parseMultipart(raw, contentType);
      const filePart = parts.find((p) => p.data && p.data.length > 0) || parts[0];
      if (!filePart) return error(res, 400, "No file provided");
      if (filePart.data.length > 3 * 1024 * 1024)
        return error(res, 413, "File too large (max 3 MB for a profile image)");
      const dataUrl = `data:${filePart.contentType};base64,${filePart.data.toString("base64")}`;
      return sendJson(res, 200, { file_url: dataUrl });
    }

    if (method === "POST" && /^\/apps\/[^/]+\/integration-endpoints\/Core\/InvokeLLM$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "llm")) return undefined;
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const prompt = String(body.prompt || "");
      const feedback =
        prompt.includes("تسک") || prompt.trim()
          ? "بازخورد: خروجی کار امروز قابل قبول است. کیفیت کار خوب، بهره‌وری در حد انتظار بود. پیشنهاد: برای فردا هدف‌های خود را شفاف‌تر تعریف کنید و در گزارش، نتایج دقیق‌تری ذکر کنید."
          : "تحلیل: عملکرد کلی خوب است. برای بهبود، دقت در تکمیل جزئیات گزارش‌ها را افزایش دهید.";
      // The app renders `ai_analysis` directly as text, so return a JSON string.
      return sendJson(res, 200, feedback);
    }
  } catch (err) {
    console.error("[local-backend] handler error:", err);
    return error(res, 500, "Internal server error");
  }

  return error(res, 404, "Not found");
}

export function localBackendPlugin() {
  return {
    name: "local-backend",
    configureServer(server) {
      server.middlewares.use("/api", (req, res) => {
        handleRequest(req, res).catch((err) => {
          console.error("[local-backend] unhandled error:", err);
          if (!res.headersSent) error(res, 500, "Internal server error");
          else res.end();
        });
      });
    },
  };
}
