// api/_shared/http.ts
function asyncHandler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(error);
      const message = String(error.message || "");
      if (error.code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
        res.status(500).json({
          error: "The Postgres database host could not be reached. Check DATABASE_URL and make sure the database is online."
        });
        return;
      }
      if (error.code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
        res.status(500).json({
          error: "The Postgres database refused the connection. Check DATABASE_URL, SSL settings, and database allowlists."
        });
        return;
      }
      res.status(500).json({ error: message || "Unexpected server error." });
    }
  };
}
function requireMethod(req, res, allowed) {
  const method = req.method || "GET";
  if (!allowed.includes(method)) {
    res.status(405).json({ error: `Method ${method} is not allowed.` });
    return false;
  }
  return true;
}

// api/_shared/auth.ts
import crypto from "crypto";
var COOKIE_NAME = "post_nerd_session";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
function getSecret() {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "post-nerd-local-dev-secret";
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 12e4, 64, "sha512").toString("hex");
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split("$");
  if (parts.length === 4 && parts[0] === "pbkdf2_sha512") {
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expected = parts[3];
    const actual = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }
  const legacy = storedHash.split(":");
  if (legacy.length === 2) {
    const [salt, expected] = legacy;
    const actual = crypto.pbkdf2Sync(password, salt, 1e5, Math.max(32, expected.length / 2), "sha512").toString("hex");
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }
  return false;
}
function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}
function createSessionToken(userId) {
  const expiresAt = Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function readSessionToken(req) {
  const cookieHeader = String(req.headers?.cookie || "");
  const cookie = cookieHeader.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;
  const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt < Math.floor(Date.now() / 1e3)) return null;
    return Number(parsed.userId);
  } catch {
    return null;
  }
}
function setSessionCookie(res, userId) {
  res.setHeader?.(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
  );
}
function clearSessionCookie(res) {
  res.setHeader?.("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// api/_shared/db.ts
import pg from "pg";

// api/_shared/defaults.ts
function toDateInputValue(date) {
  return date.toISOString().split("T")[0];
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function getDesignDueDate(postDate) {
  const date = /* @__PURE__ */ new Date(`${postDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return postDate;
  return toDateInputValue(addDays(date, -2));
}
var defaultBrandKit = {
  name: "",
  industry: "",
  toneOfVoice: "",
  brandColors: ["#2563eb", "#14b8a6", "#f59e0b", "#0f172a"],
  messagingThemes: [],
  additionalNotes: "",
  isConfigured: false
};
var defaultSheetsConfig = {
  sheetUrl: "",
  spreadsheetId: "",
  range: "A1:H500",
  isSynced: false
};
function createSamplePosts(now = /* @__PURE__ */ new Date()) {
  const firstDate = toDateInputValue(addDays(now, 1));
  const secondDate = toDateInputValue(addDays(now, 2));
  const thirdDate = toDateInputValue(addDays(now, 4));
  return [
    {
      id: "sample-1",
      title: "Launch week reminder",
      platform: "Instagram",
      postDate: firstDate,
      postTime: "09:30",
      contentType: "Graphics",
      status: "Needs Asset",
      originalCopy: "Prepare the announcement graphic and short caption for the launch week reminder.",
      designAssetStatus: "Not Started",
      designDueDate: getDesignDueDate(firstDate),
      reminderSent: false
    },
    {
      id: "sample-2",
      title: "Founder insight post",
      platform: "LinkedIn",
      postDate: secondDate,
      postTime: "12:00",
      contentType: "Text",
      status: "Draft",
      originalCopy: "Share a practical lesson learned from the product build.",
      designAssetStatus: "Not Required",
      designDueDate: getDesignDueDate(secondDate),
      reminderSent: false
    },
    {
      id: "sample-3",
      title: "Short-form product demo",
      platform: "TikTok",
      postDate: thirdDate,
      postTime: "18:00",
      contentType: "Video",
      status: "Scheduled",
      originalCopy: "Record a simple before-and-after walkthrough showing the core workflow.",
      designAssetStatus: "Not Required",
      designDueDate: getDesignDueDate(thirdDate),
      reminderSent: false
    }
  ];
}

// api/_shared/db.ts
var { Pool } = pg;
var pool = null;
var initialized = false;
function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!pool) {
    const connectionUrl = new URL(process.env.DATABASE_URL);
    const sslMode = connectionUrl.searchParams.get("sslmode");
    connectionUrl.searchParams.delete("sslmode");
    pool = new Pool({
      connectionString: connectionUrl.toString(),
      ssl: sslMode ? { rejectUnauthorized: false } : void 0,
      max: 5
    });
  }
  return pool;
}
async function ensureSchema() {
  if (initialized) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      post_date DATE NOT NULL,
      post_time TEXT NOT NULL,
      content_type TEXT NOT NULL,
      status TEXT NOT NULL,
      original_copy TEXT,
      suggested_copy TEXT,
      design_asset_status TEXT,
      design_due_date DATE,
      reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_copy TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS suggested_copy TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS design_asset_status TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS design_due_date DATE;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id INTEGER;
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER;

    DO $$
    DECLARE
      user_id_type TEXT;
      default_user_id INTEGER;
    BEGIN
      SELECT data_type INTO user_id_type
        FROM information_schema.columns
        WHERE table_name = 'posts'
          AND column_name = 'user_id';

      IF user_id_type = 'integer' THEN
        SELECT id INTO default_user_id FROM users ORDER BY id LIMIT 1;

        IF default_user_id IS NULL THEN
          INSERT INTO users (email, password_hash, name)
          VALUES ('workspace@post-nerd.local', 'managed-by-post-nerd', 'Post Nerd Workspace')
          RETURNING id INTO default_user_id;
        END IF;

        EXECUTE format('ALTER TABLE posts ALTER COLUMN user_id SET DEFAULT %s', default_user_id);
      ELSIF user_id_type IS NOT NULL THEN
        ALTER TABLE posts ALTER COLUMN user_id SET DEFAULT 'default-workspace';
      END IF;
    END
    $$;
  `);
  initialized = true;
}
function settingKey(userId, key) {
  return `user:${userId}:${key}`;
}
async function getSetting(userId, key, fallback) {
  await ensureSchema();
  const result = await getPool().query("SELECT value FROM app_settings WHERE key = $1", [settingKey(userId, key)]);
  return result.rows[0]?.value ?? fallback;
}
async function setSetting(userId, key, value) {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [settingKey(userId, key), JSON.stringify(value)]
  );
  return value;
}
function rowToPost(row) {
  const dateValue = (value) => {
    if (!value) return void 0;
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return String(value);
  };
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    postDate: dateValue(row.post_date) || "",
    postTime: row.post_time,
    contentType: row.content_type,
    status: row.status,
    originalCopy: row.original_copy ?? "",
    suggestedCopy: row.suggested_copy ?? void 0,
    designAssetStatus: row.design_asset_status ?? void 0,
    designDueDate: dateValue(row.design_due_date),
    reminderSent: row.reminder_sent
  };
}
async function getUserById(userId) {
  await ensureSchema();
  const result = await getPool().query("SELECT id, email, name FROM users WHERE id = $1", [userId]);
  return result.rows[0] ?? null;
}
async function createUser(email, password, name) {
  await ensureSchema();
  const normalizedEmail = email.trim().toLowerCase();
  const result = await getPool().query(
    `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name
    `,
    [normalizedEmail, hashPassword(password), name.trim() || normalizedEmail.split("@")[0]]
  );
  return result.rows[0];
}
async function authenticateUser(email, password) {
  await ensureSchema();
  const result = await getPool().query("SELECT id, email, name, password_hash FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, name: user.name };
}
async function getPosts(userId) {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT * FROM posts WHERE user_id = $1 ORDER BY post_date ASC, post_time ASC, created_at ASC",
    [userId]
  );
  return result.rows.map(rowToPost);
}
async function replacePosts(userId, posts) {
  await ensureSchema();
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM posts WHERE user_id = $1", [userId]);
    for (const post of posts) {
      await client.query(
        `
          INSERT INTO posts (
            id, title, platform, post_date, post_time, content_type, status,
            original_copy, suggested_copy, design_asset_status, design_due_date, reminder_sent, user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          post.id,
          post.title,
          post.platform,
          post.postDate,
          post.postTime,
          post.contentType,
          post.status,
          post.originalCopy ?? "",
          post.suggestedCopy ?? null,
          post.designAssetStatus ?? null,
          post.designDueDate ?? null,
          post.reminderSent ?? false,
          userId
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getPosts(userId);
}
async function upsertPost(userId, post) {
  await ensureSchema();
  const updateResult = await getPool().query(
    `
      UPDATE posts
      SET
        title = $2,
        platform = $3,
        post_date = $4,
        post_time = $5,
        content_type = $6,
        status = $7,
        original_copy = $8,
        suggested_copy = $9,
        design_asset_status = $10,
        design_due_date = $11,
        reminder_sent = $12,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $13
    `,
    [
      post.id,
      post.title,
      post.platform,
      post.postDate,
      post.postTime,
      post.contentType,
      post.status,
      post.originalCopy ?? "",
      post.suggestedCopy ?? null,
      post.designAssetStatus ?? null,
      post.designDueDate ?? null,
      post.reminderSent ?? false,
      userId
    ]
  );
  if (updateResult.rowCount === 0) {
    await getPool().query(
      `
        INSERT INTO posts (
          id, title, platform, post_date, post_time, content_type, status,
          original_copy, suggested_copy, design_asset_status, design_due_date, reminder_sent, updated_at, user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
      `,
      [
        post.id,
        post.title,
        post.platform,
        post.postDate,
        post.postTime,
        post.contentType,
        post.status,
        post.originalCopy ?? "",
        post.suggestedCopy ?? null,
        post.designAssetStatus ?? null,
        post.designDueDate ?? null,
        post.reminderSent ?? false,
        userId
      ]
    );
  }
  const result = await getPool().query("SELECT * FROM posts WHERE id = $1 AND user_id = $2", [post.id, userId]);
  return rowToPost(result.rows[0]);
}
async function patchPost(userId, id, patch) {
  const existing = (await getPosts(userId)).find((post) => post.id === id);
  if (!existing) throw new Error("Post not found.");
  return upsertPost(userId, { ...existing, ...patch, id });
}
async function getBrandKit(userId) {
  return getSetting(userId, "brandKit", defaultBrandKit);
}
async function setBrandKit(userId, brandKit) {
  return setSetting(userId, "brandKit", brandKit);
}
async function getSheetsConfig(userId) {
  return getSetting(userId, "sheetsConfig", defaultSheetsConfig);
}
async function setSheetsConfig(userId, config) {
  return setSetting(userId, "sheetsConfig", config);
}
async function seedIfEmpty(userId) {
  const posts = await getPosts(userId);
  if (posts.length === 0) {
    await replacePosts(userId, createSamplePosts());
  }
}
async function getAppState(userId) {
  await seedIfEmpty(userId);
  const [posts, brandKit, sheetsConfig] = await Promise.all([getPosts(userId), getBrandKit(userId), getSheetsConfig(userId)]);
  return {
    posts,
    brandKit,
    sheetsConfig,
    notificationsEnabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY
  };
}
async function savePushSubscription(userId, id, subscription) {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO push_subscriptions (id, user_id, subscription)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription
    `,
    [id, userId, JSON.stringify(subscription)]
  );
}
async function getPushSubscriptions() {
  await ensureSchema();
  const result = await getPool().query("SELECT user_id, subscription FROM push_subscriptions ORDER BY created_at ASC");
  return result.rows;
}
async function getDueReminderPosts(now = /* @__PURE__ */ new Date()) {
  await ensureSchema();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);
  const result = await getPool().query(
    `
      SELECT * FROM posts
      WHERE reminder_sent = FALSE
        AND status != 'Posted'
        AND (
          post_date < $1
          OR (post_date = $1 AND post_time <= $2)
          OR (
            content_type = 'Graphics'
            AND design_asset_status != 'Completed'
            AND design_due_date <= $1
          )
        )
      ORDER BY post_date ASC, post_time ASC
      LIMIT 10
    `,
    [today, currentTime]
  );
  return result.rows.map((row) => ({ ...rowToPost(row), userId: row.user_id }));
}
async function markReminderSent(postId) {
  await ensureSchema();
  await getPool().query("UPDATE posts SET reminder_sent = TRUE, updated_at = NOW() WHERE id = $1", [postId]);
}

// api/_shared/gemini.ts
import { GoogleGenAI } from "@google/genai";
var aiClient = null;
function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}
function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

// api/_shared/sheets.ts
var SHEET_TEMPLATE_HEADERS = [
  "Title",
  "Platform",
  "Post Date",
  "Post Time",
  "Content Type",
  "Status",
  "Original Copy",
  "Design Asset Status"
];
function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current.trim());
      current = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function extractSpreadsheetId(sheetUrl) {
  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}
function getCsvExportUrl(sheetUrl) {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return null;
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  url.searchParams.set("format", "csv");
  const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/);
  if (gidMatch) url.searchParams.set("gid", gidMatch[1]);
  return { spreadsheetId, exportUrl: url.toString() };
}
function firstMatchingValue(headers, row, keywords, fallback = "") {
  const index = headers.findIndex((header) => keywords.some((keyword) => header.includes(keyword)));
  return index >= 0 && row[index] ? row[index].trim() : fallback;
}
function normalizePlatform(value) {
  const platform = value.toLowerCase();
  if (platform.includes("linked")) return "LinkedIn";
  if (platform.includes("twit") || platform === "x") return "Twitter";
  if (platform.includes("face")) return "Facebook";
  if (platform.includes("tik")) return "TikTok";
  if (platform.includes("youtube") || platform.includes("yt")) return "YouTube";
  return "Instagram";
}
function normalizeContentType(value) {
  const type = value.toLowerCase();
  if (type.includes("video") || type.includes("reel") || type.includes("short")) return "Video";
  if (type.includes("thread")) return "Threads";
  if (type.includes("text") || type.includes("tweet")) return "Text";
  if (type.includes("graphic") || type.includes("image") || type.includes("carousel")) return "Graphics";
  return "Other";
}
function normalizeStatus(value, contentType) {
  const status = value.toLowerCase();
  if (status.includes("posted") || status.includes("done") || status.includes("published")) return "Posted";
  if (status.includes("draft")) return "Draft";
  if (status.includes("asset") || status.includes("design") || status.includes("need")) return "Needs Asset";
  if (contentType === "Graphics") return "Needs Asset";
  return "Scheduled";
}
function normalizeDesignStatus(value, contentType, status) {
  if (contentType !== "Graphics") return "Not Required";
  const designStatus = value.toLowerCase();
  if (designStatus.includes("complete") || designStatus.includes("ready") || status === "Posted") return "Completed";
  if (designStatus.includes("progress") || designStatus.includes("draft")) return "In Progress";
  return "Not Started";
}
function mapSheetRowsToPosts(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const today = toDateInputValue(/* @__PURE__ */ new Date());
  return rows.slice(1).map((row, index) => {
    const title = firstMatchingValue(headers, row, ["title", "topic", "headline", "item"], `Post ${index + 1}`);
    const platform = normalizePlatform(firstMatchingValue(headers, row, ["platform", "channel", "network"], "Instagram"));
    const postDate = firstMatchingValue(headers, row, ["post date", "date", "day"], today);
    const postTime = firstMatchingValue(headers, row, ["post time", "time", "hour"], "12:00");
    const contentType = normalizeContentType(firstMatchingValue(headers, row, ["content type", "type", "format"], "Graphics"));
    const status = normalizeStatus(firstMatchingValue(headers, row, ["status", "state"], ""), contentType);
    const originalCopy = firstMatchingValue(headers, row, ["original copy", "copy", "caption", "text", "notes", "description"], "");
    const designAssetStatus = normalizeDesignStatus(
      firstMatchingValue(headers, row, ["design asset status", "asset status", "design status"], ""),
      contentType,
      status
    );
    return {
      id: `sheet-row-${index + 1}`,
      title,
      platform,
      postDate,
      postTime,
      contentType,
      status,
      originalCopy,
      designAssetStatus,
      designDueDate: getDesignDueDate(postDate),
      reminderSent: false
    };
  });
}

// api/_shared/handlers.ts
import webPush from "web-push";
function nowLabel() {
  return (/* @__PURE__ */ new Date()).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
var healthHandler = asyncHandler(async (_req, res) => {
  res.json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
async function requireUserId(req, res) {
  const userId = readSessionToken(req);
  if (!userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return null;
  }
  const user = await getUserById(userId);
  if (!user) {
    res.status(401).json({ error: "Your session is no longer valid. Please log in again." });
    return null;
  }
  return user.id;
}
var meHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET"])) return;
  const userId = readSessionToken(req);
  const user = userId ? await getUserById(userId) : null;
  res.json({ user });
});
var registerHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const { email, password, name } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    res.status(400).json({ error: "Use an email and a password with at least 8 characters." });
    return;
  }
  try {
    const user = await createUser(email, password, name || "");
    setSessionCookie(res, user.id);
    res.json({ user });
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }
});
var loginHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const { email, password } = req.body || {};
  const user = email && password ? await authenticateUser(email, password) : null;
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  setSessionCookie(res, user.id);
  res.json({ user });
});
var logoutHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  clearSessionCookie(res);
  res.json({ ok: true });
});
var stateHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  res.json(await getAppState(userId));
});
var brandKitHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["PUT"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const brandKit = req.body;
  if (!brandKit) {
    res.status(400).json({ error: "Brand kit payload is required." });
    return;
  }
  res.json({ brandKit: await setBrandKit(userId, { ...brandKit, isConfigured: true }) });
});
var postsHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST", "PATCH"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (req.method === "POST") {
    const post = req.body;
    if (!post?.title) {
      res.status(400).json({ error: "Post title is required." });
      return;
    }
    const saved = await upsertPost(userId, {
      ...post,
      id: post.id || `manual-${Date.now()}`,
      designDueDate: post.designDueDate || getDesignDueDate(post.postDate),
      reminderSent: post.reminderSent ?? false
    });
    res.json({ post: saved });
    return;
  }
  const { id, patch } = req.body || {};
  if (!id || !patch) {
    res.status(400).json({ error: "Post id and patch are required." });
    return;
  }
  res.json({ post: await patchPost(userId, id, patch) });
});
var syncSheetsHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST", "GET"])) return;
  if (req.method === "GET") {
    res.json({
      templateHeaders: SHEET_TEMPLATE_HEADERS,
      sampleRows: [
        ["Launch announcement", "Instagram", "2026-08-01", "10:00", "Graphics", "Needs Asset", "Announce the new feature", "Not Started"],
        ["Founder lesson", "LinkedIn", "2026-08-02", "12:30", "Text", "Draft", "Share a practical lesson", "Not Required"]
      ]
    });
    return;
  }
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { sheetUrl, range } = req.body || {};
  if (!sheetUrl) {
    res.status(400).json({ error: "Paste a public Google Sheet URL before syncing." });
    return;
  }
  const exportInfo = getCsvExportUrl(sheetUrl);
  if (!exportInfo) {
    res.status(400).json({ error: "That does not look like a valid Google Sheets URL." });
    return;
  }
  const response = await fetch(exportInfo.exportUrl);
  if (!response.ok) {
    res.status(response.status).json({
      error: "Could not download the sheet. Set sharing to 'Anyone with the link can view' and try again."
    });
    return;
  }
  const csvText = await response.text();
  const posts = mapSheetRowsToPosts(parseCSV(csvText));
  if (posts.length === 0) {
    res.status(400).json({
      error: `The sheet downloaded, but no post rows were found. Use these headers: ${SHEET_TEMPLATE_HEADERS.join(", ")}.`
    });
    return;
  }
  const savedPosts = await replacePosts(userId, posts);
  const config = await setSheetsConfig(userId, {
    sheetUrl,
    spreadsheetId: exportInfo.spreadsheetId,
    range: range || "A1:H500",
    isSynced: true,
    lastSyncTime: nowLabel()
  });
  res.json({
    spreadsheetId: exportInfo.spreadsheetId,
    posts: savedPosts,
    rowCount: savedPosts.length,
    sheetsConfig: config,
    lastSync: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var suggestCopyHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { post, brandKit } = req.body || {};
  if (!post) {
    res.status(400).json({ error: "Post details are required." });
    return;
  }
  const ai = getGemini();
  const brandKitPrompt = brandKit?.isConfigured ? `Brand Info:
- Name: ${brandKit.name}
- Industry: ${brandKit.industry}
- Tone of Voice: ${brandKit.toneOfVoice}
- Messaging Themes: ${(brandKit.messagingThemes || []).join(", ")}
- Custom Brand Directives: ${brandKit.additionalNotes}` : "No custom brand kit supplied. Use concise, practical, platform-aware copy.";
  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Write ready-to-post social copy for:
- Title: ${post.title}
- Platform: ${post.platform}
- Content Type: ${post.contentType}
- Notes: ${post.originalCopy || "None provided"}

${brandKitPrompt}

Return only the final copy. Keep it useful, specific, and formatted for the platform.`
          }
        ]
      }
    ],
    config: {
      temperature: 0.75
    }
  });
  const saved = await patchPost(userId, post.id, { suggestedCopy: response.text || "" });
  res.json({ suggestedCopy: saved.suggestedCopy, post: saved });
});
var chatHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const { messages, brandKit, currentPost } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Messages array is required." });
    return;
  }
  const ai = getGemini();
  const configuredKit = brandKit;
  const formattedContents = messages.slice(-10).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.text }]
  }));
  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: formattedContents,
    config: {
      temperature: 0.7,
      systemInstruction: `You are Bestie, a concise content planning assistant.
Help with posting schedules, reminders, caption drafts, and visual preparation.
${configuredKit?.isConfigured ? `Brand: ${configuredKit.name}. Industry: ${configuredKit.industry}. Tone: ${configuredKit.toneOfVoice}.` : ""}
${currentPost ? `Current post: ${currentPost.title} for ${currentPost.platform} on ${currentPost.postDate}.` : ""}`
    }
  });
  res.json({ reply: response.text || "I could not create a reply." });
});
var pushSubscribeHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["POST"])) return;
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const subscription = req.body?.subscription || req.body;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: "A browser push subscription is required." });
    return;
  }
  await savePushSubscription(userId, subscription.endpoint, subscription);
  res.json({ ok: true });
});
var runRemindersHandler = asyncHandler(async (req, res) => {
  if (!requireMethod(req, res, ["GET", "POST"])) return;
  const cronSecret = process.env.CRON_SECRET;
  const authorization = String(req.headers?.authorization || "");
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized reminder run." });
    return;
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    res.status(400).json({ error: "VAPID push environment variables are not configured." });
    return;
  }
  webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const [subscriptions, duePosts] = await Promise.all([getPushSubscriptions(), getDueReminderPosts()]);
  let sent = 0;
  for (const post of duePosts) {
    const payload = JSON.stringify({
      title: post.contentType === "Graphics" && post.designAssetStatus !== "Completed" ? "Visual asset due" : "Time to post",
      body: `${post.title} - ${post.platform} - ${post.postDate} ${post.postTime}`,
      url: process.env.APP_URL || "/"
    });
    const postUserId = post.userId;
    const userSubscriptions = subscriptions.filter((subscription) => !postUserId || subscription.user_id === postUserId);
    const deliveries = await Promise.allSettled(
      userSubscriptions.map((subscription) => webPush.sendNotification(subscription.subscription, payload))
    );
    const successfulDeliveries = deliveries.filter((delivery) => delivery.status === "fulfilled").length;
    sent += successfulDeliveries;
    if (successfulDeliveries > 0) {
      await markReminderSent(post.id);
    }
  }
  res.json({ ok: true, duePosts: duePosts.length, subscriptions: subscriptions.length, sent });
});

// api/brand-kit.ts
var brand_kit_default = brandKitHandler;
export {
  brand_kit_default as default
};
