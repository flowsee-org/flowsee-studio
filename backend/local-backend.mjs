import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

// SMTP is optional; without it messages stay in the private local outbox.
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST) {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(join(DATA_DIR, 'mail-outbox.jsonl'), JSON.stringify({ to, subject, html }) + '\n', { mode: 0o600 });
    return { local: true };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
  });
  return transport.sendMail({ from: process.env.SMTP_FROM || 'Flowsee <noreply@localhost>', to, subject, html });
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
const DATA_DIR = process.env.STUDIO_DATA_DIR || join(ROOT, ".local");
const DB_FILE = join(DATA_DIR, "db.json");
const OTP_INBOX = join(DATA_DIR, "otp-inbox.log");
const KNOWN_ENTITIES = [
  "Announcement",
  "AppSettings",
  "Client",
  "Comment",
  "Contact",
  "Deal",
  "ActivityLog",
  "AccountingPeriodLock",
  "BlogCategory",
  "BlogPost",
  "Customer",
  "Document",
  "Employee",
  "Expense",
  "Goal",
  "Income",
  "LeaveRequest",
  "Meeting",
  "Notification",
  "Password",
  "Project",
  "Salary",
  "SiteProject",
  "Sprint",
  "Tag",
  "Task",
  "TaskTemplate",
  "User",
  "WorkReport",
];

function saveDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2), { mode: 0o600 });
  renameSync(DB_FILE + '.tmp', DB_FILE);
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
    if (!parsed?.secret || !Array.isArray(parsed.users)) throw new Error('Invalid database structure');
    parsed.entities ||= {};
    for (const name of KNOWN_ENTITIES) parsed.entities[name] ||= [];
    return parsed;
  } catch (err) {
    throw new Error(`Cannot read database: ${err.message}`);
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
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
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
  return signToken({ sub: user.id, email: user.email, iat: now, version: user.session_version || 0, exp: now + TOKEN_TTL_MS });
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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const matches = db.users.filter((u) => String(u.email || "").trim().toLowerCase() === normalizedEmail);
  // Prefer a usable account if older data contains a soft-deleted duplicate.
  return matches.find((u) => !u.deleted_at && u.is_active !== false)
    || matches.find((u) => !u.deleted_at)
    || matches[0];
}
function bootstrapAdmin() {
  if (db.users.length || !process.env.STUDIO_ADMIN_EMAIL) return;
  const password = process.env.STUDIO_ADMIN_PASSWORD || '';
  if (password.length < 12) throw new Error('STUDIO_ADMIN_PASSWORD must contain at least 12 characters');
  const now = new Date().toISOString();
  db.users.push({ id: randomId('u'), email: process.env.STUDIO_ADMIN_EMAIL.toLowerCase(),
    password_hash: hashPassword(password), full_name: 'مدیر سیستم', role: 'superadmin',
    is_verified: true, is_active: true, created_date: now, updated_date: now });
  saveDb();
}
bootstrapAdmin();

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
  const resetUrl = `${process.env.STUDIO_PUBLIC_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

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
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 12 * 1024 * 1024) { reject(Object.assign(new Error('Body too large'), { status: 413 })); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(body, contentType) {
  const m = /boundary=([^;]+)/.exec(contentType || "");
  if (!m) return [];
  let boundary = m[1].trim().replace(/^"|"$/g, "");
  boundary = "--" + boundary;
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
  const user = db.users.find(u => u.id === payload.sub);
  if (!user || user.deleted_at || user.is_active === false || user.force_logout || (user.session_version || 0) !== (payload.version || 0)) return null;
  return user;
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
const authAttempts = new Map();
export async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://local");
  let path = decodeURIComponent(url.pathname);
  if (pathStartsWith(path, "/api")) path = path.slice("/api".length) || "/";
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === 'POST' && /\/auth\//.test(path)) {
      const now = Date.now();
      for (const [key, value] of authAttempts) if (value.until < now) authAttempts.delete(key);
      const key = req.socket.remoteAddress || 'local';
      const entry = authAttempts.get(key) || { count: 0, until: now + 60000 };
      entry.count++; authAttempts.set(key, entry);
      if (entry.count > 30) return error(res, 429, 'Too many attempts; try again in a minute');
    }
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
      if (process.env.STUDIO_ALLOW_REGISTRATION !== 'true') return error(res, 403, 'Registration is disabled; ask an administrator for an invitation');
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
        // an email round-trip. Hosted services would require OTP verification here.
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
      if (!user || user.deleted_at || user.is_active === false || !verifyPassword(String(body.password || ""), user.password_hash))
        return error(res, 401, "ایمیل یا رمز عبور نامعتبر است");
      user.force_logout = false;
      user.last_login = new Date().toISOString();
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
      user.session_version = (user.session_version || 0) + 1;
      user.updated_date = new Date().toISOString();
      resets.delete(token);
      saveDb();
      return sendJson(res, 200, { success: true });
    }

    if (method === "POST" && path === "/apps/auth/logout") {
      const user = getAuthUser(req);
      if (user) { user.session_version = (user.session_version || 0) + 1; saveDb(); }
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
      const now = new Date().toISOString();
      const existingUser = findUserByEmail(email);
      if (existingUser && !existingUser.deleted_at && existingUser.is_active !== false)
        return error(res, 409, "An account with this email already exists");
      if (existingUser) {
        if (existingUser.role === "superadmin" && (u.role !== "superadmin" || role !== "superadmin"))
          return error(res, 403, "Only a superadmin can restore a superadmin account");
        const initialPassword = String(body.initial_password || "");
        delete existingUser.deleted_at;
        delete existingUser.deleted_by;
        existingUser.is_active = true;
        existingUser.email = email;
        existingUser.full_name = String(body.full_name || existingUser.full_name || "");
        existingUser.phone = String(body.phone || existingUser.phone || "");
        existingUser.role = role;
        if (initialPassword.length >= 6) existingUser.password_hash = hashPassword(initialPassword);
        existingUser.updated_date = now;
        saveDb();
        console.log(`[local-auth] restored ${email} (role: ${role})`);
        return sendJson(res, 200, { success: true, reactivated: true, user: publicUser(existingUser) });
      }
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
      if (!initialPassword) {
        const token = randomBytes(24).toString('hex');
        resets.set(token, { email, expiresAt: Date.now() + 60 * 60 * 1000 });
        await deliverReset(email, token);
      }

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
      if (!KNOWN_ENTITIES.includes(entityName) && entityName !== "User") return error(res, 404, "Unknown entity");
      const isUserEntity = entityName === "User";
      const manager = ['admin', 'superadmin'].includes(u.role);
      if (['Expense', 'Income', 'Salary', 'AccountingPeriodLock', 'Employee', 'AppSettings'].includes(entityName) && !manager && (entityName !== 'AppSettings' || method !== 'GET')) return error(res, 403, 'Forbidden');
      const store = isUserEntity ? db.users : (db.entities[entityName] ||= []);
      const rec = store.find((r) => r.id === recordId);
      if (!rec) return error(res, 404, `${entityName} not found`);
      if (isUserEntity && u.role !== 'superadmin' && (u.role !== 'admin' || rec.role !== 'user')) return error(res, 403, 'Forbidden');
      if (!isUserEntity && rec.created_by_id !== u.id && !['admin', 'superadmin'].includes(u.role)) return error(res, 403, 'Forbidden');
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
      if (!KNOWN_ENTITIES.includes(entityName) && entityName !== "User") return error(res, 404, "Unknown entity");
      const isUserEntity = entityName === "User";
      const manager = ['admin', 'superadmin'].includes(u.role);
      if (['Expense', 'Income', 'Salary', 'AccountingPeriodLock', 'Employee', 'AppSettings'].includes(entityName) && !manager && (entityName !== 'AppSettings' || method !== 'GET')) return error(res, 403, 'Forbidden');
      const store = isUserEntity ? db.users : (db.entities[entityName] ||= []);

      const sanitize = isUserEntity ? publicUser : (r) => r;
      if (method === "GET") {
        if (recordId) {
          const rec = store.find((r) => r.id === recordId && !r.deleted_at);
          if (!rec) return error(res, 404, `${entityName} not found`);
          if (!manager && ['WorkReport', 'LeaveRequest', 'Notification'].includes(entityName) && rec.created_by_id !== u.id && rec.user_id !== u.id && rec.employee_id !== u.id) return error(res, 403, 'Forbidden');
          return sendJson(res, 200, sanitize(rec));
        }
        let out = [...store];
        if (!manager && ['WorkReport', 'LeaveRequest', 'Notification'].includes(entityName)) out = out.filter(r => r.created_by_id === u.id || r.user_id === u.id || r.employee_id === u.id);
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
        if (isUserEntity) return error(res, 403, "Use the invite endpoint to create users");
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
        if (!manager && !isUserEntity && ['WorkReport', 'LeaveRequest', 'Notification', 'Announcement'].includes(entityName) && rec.created_by_id !== u.id && rec.user_id !== u.id) return error(res, 403, 'Forbidden');
        // Never let a document overwrite its own identity or audit fields.
        const { id: _id, created_date: _cd, created_by_id: _cbi, ...rest } = body;
        if (isUserEntity) {
          const manager = u.role === 'admin' || u.role === 'superadmin';
          if (rec.id !== u.id && !manager) return error(res, 403, 'Forbidden');
          if (rec.role === 'superadmin' && rec.id !== u.id && u.role !== 'superadmin') return error(res, 403, 'Forbidden');
          if (body.role !== undefined && body.role !== rec.role) {
            if (!manager || rec.id === u.id || rec.role === 'superadmin' || (body.role === 'superadmin' && u.role !== 'superadmin')) return error(res, 403, 'Cannot change role');
            if (!['user', 'admin', 'superadmin'].includes(body.role)) return error(res, 400, 'Invalid role');
          }
          const allowed = manager ? ['full_name', 'phone', 'profile_image', 'role', 'is_active', 'module_access', 'force_logout'] : ['full_name', 'phone', 'profile_image'];
          for (const key of Object.keys(rest)) if (!allowed.includes(key)) delete rest[key];
          if (rest.force_logout) rec.session_version = (rec.session_version || 0) + 1;
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
        if (!manager && !isUserEntity && deleted.created_by_id !== u.id) return error(res, 403, 'Forbidden');
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
      if (!['admin', 'superadmin'].includes(u.role)) return error(res, 403, 'Forbidden');
      const store = entityName === 'User' ? db.users.map(publicUser) : db.entities[entityName] || [];
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
      const entities = Object.fromEntries(Object.entries(db.entities).filter(([name]) => name !== "User"));
      const exportData = { entities, users: db.users.map((u) => { const { password_hash, ...rest } = u; return rest; }) };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="flowsee-backup-${new Date().toISOString().slice(0,10)}.json"`);
      return res.end(JSON.stringify(exportData, null, 2));
    }
    if (method === "POST" && /\/restore$/.test(path)) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "restore")) return undefined;
      if (u.role !== "superadmin") return error(res, 403, "Only superadmin can restore");
      const raw = await readBody(req);
      const payload = String(req.headers['content-type'] || '').includes('multipart/form-data') ? parseMultipart(raw, req.headers['content-type']).find(p => p.filename)?.data : raw;
      if (!payload) return error(res, 400, 'No backup file');
      const body = JSON.parse(payload.toString('utf8'));
      if (body.entities && typeof body.entities === 'object' && Object.entries(body.entities).every(([key, value]) => KNOWN_ENTITIES.includes(key) && key !== 'User' && Array.isArray(value))) {
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

    // --- Site content blog fallback (when VITE_MAIN_API_URL is local) ----
    if (pathStartsWith(path, "/studio/site-content/blog")) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "blog")) return undefined;
      const subPath = path.replace(/^\/studio\/site-content\/blog\/?/, "");
      const posts = db.entities["BlogPost"] ||= [];
      const categories = db.entities["BlogCategory"] ||= [
        { id: 1, name: "تکنولوژی و وب" },
        { id: 2, name: "کسب‌وکار و مدیریت" },
        { id: 3, name: "طراحی محصول" },
      ];

      if (method === "GET") {
        const sorted = [...posts.filter(p => !p.deleted_at)].sort((a, b) => (Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999)));
        return sendJson(res, 200, { posts: sorted, categories });
      }

      if (method === "POST" && !subPath) {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        const newPost = {
          id: randomId("post"),
          ...body,
          sort_order: Number(body.sort_order ?? 0),
          created_by_id: u.id,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        };
        posts.unshift(newPost);
        saveDb();
        return sendJson(res, 201, { success: true, post: newPost });
      }

      const postMatch = /^([^/]+)$/.exec(subPath);
      if (postMatch) {
        const postId = postMatch[1];
        const existing = posts.find(p => String(p.id) === String(postId) && !p.deleted_at);
        if (!existing) return error(res, 404, "Post not found");

        if (method === "PUT") {
          const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
          Object.assign(existing, body, {
            sort_order: Number(body.sort_order ?? existing.sort_order ?? 0),
            updated_date: new Date().toISOString()
          });
          saveDb();
          return sendJson(res, 200, { success: true, post: existing });
        }

        if (method === "DELETE") {
          existing.deleted_at = new Date().toISOString();
          saveDb();
          return sendJson(res, 200, { success: true, message: "Post deleted" });
        }
      }
      return error(res, 405, "Method not allowed");
    }

    // --- Site content projects fallback (when VITE_MAIN_API_URL is local) ----
    if (pathStartsWith(path, "/studio/site-content") && !pathStartsWith(path, "/studio/site-content/blog") && !pathStartsWith(path, "/studio/site-content/images")) {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "site-content")) return undefined;
      const subPath = path.replace(/^\/studio\/site-content\/?/, "");
      const projects = db.entities["SiteProject"] ||= [];
      const services = [
        { id: "srv-1", title: "طراحی محصول و UI/UX" },
        { id: "srv-2", title: "توسعه وب و اپلیکیشن" },
        { id: "srv-3", title: "برندینگ و هویت بصری" },
      ];

      if (method === "GET" && !subPath) {
        const sorted = [...projects.filter(p => !p.deleted_at)].sort((a, b) => (Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999)));
        return sendJson(res, 200, { projects: sorted, services });
      }

      if (method === "POST" && subPath === "projects") {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        const newProject = {
          id: randomId("sproj"),
          ...body,
          sort_order: Number(body.sort_order ?? 0),
          created_by_id: u.id,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        };
        projects.push(newProject);
        saveDb();
        return sendJson(res, 201, { success: true, project: newProject });
      }

      const caseStudyMatch = /^projects\/([^/]+)\/case-study$/.exec(subPath);
      if (caseStudyMatch && method === "PUT") {
        const projId = caseStudyMatch[1];
        const proj = projects.find(p => String(p.id) === String(projId) && !p.deleted_at);
        if (!proj) return error(res, 404, "Project not found");
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        proj.case_study = body;
        proj.updated_date = new Date().toISOString();
        saveDb();
        return sendJson(res, 200, { success: true, case_study: body });
      }

      const projMatch = /^projects\/([^/]+)$/.exec(subPath);
      if (projMatch) {
        const projId = projMatch[1];
        const existing = projects.find(p => String(p.id) === String(projId) && !p.deleted_at);
        if (!existing) return error(res, 404, "Project not found");

        if (method === "PUT") {
          const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
          Object.assign(existing, body, {
            sort_order: Number(body.sort_order ?? existing.sort_order ?? 0),
            updated_date: new Date().toISOString()
          });
          saveDb();
          return sendJson(res, 200, { success: true, project: existing });
        }

        if (method === "DELETE") {
          existing.deleted_at = new Date().toISOString();
          saveDb();
          return sendJson(res, 200, { success: true, message: "Project deleted" });
        }
      }

      return error(res, 405, "Method not allowed");
    }

    if (pathStartsWith(path, "/studio/site-content/images") && method === "POST") {
      const u = getAuthUser(req);
      if (!requireUser(res, u, "images")) return undefined;
      const raw = await readBody(req);
      const contentType = String(req.headers["content-type"] || "");
      const parts = parseMultipart(raw, contentType);
      const filePart = parts.find((p) => p.data && p.data.length > 0) || parts[0];
      if (!filePart) return error(res, 400, "No image provided");
      const dataUrl = `data:${filePart.contentType || "image/png"};base64,${filePart.data.toString("base64")}`;
      return sendJson(res, 200, { path: dataUrl, url: dataUrl });
    }

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
      const endpoint = process.env.STUDIO_LLM_URL || 'http://127.0.0.1:11434/api/generate';
      const response = await fetch(endpoint, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.STUDIO_LLM_MODEL || 'qwen2.5:7b', prompt: String(body.prompt || ''), stream: false }),
        signal: AbortSignal.timeout(120000) });
      if (!response.ok) return error(res, 503, 'Local language model is unavailable');
      const result = await response.json();
      return sendJson(res, 200, result.response);
    }
  } catch (err) {
    console.error("[local-backend] handler error:", err);
    return error(res, err.status || (err instanceof SyntaxError ? 400 : 500), err.status ? err.message : "Request failed");
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
