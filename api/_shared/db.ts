import pg from "pg";
import { AuthUser, hashPassword, verifyPassword } from "./auth.ts";
import { AppState, BrandKit, PostItem, SheetsConfig } from "./types.ts";
import { createSamplePosts, defaultBrandKit, defaultSheetsConfig } from "./defaults.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let initialized = false;

function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    const connectionUrl = new URL(process.env.DATABASE_URL);
    const sslMode = connectionUrl.searchParams.get("sslmode");
    connectionUrl.searchParams.delete("sslmode");

    pool = new Pool({
      connectionString: connectionUrl.toString(),
      ssl: sslMode ? { rejectUnauthorized: false } : undefined,
      max: 5,
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

function settingKey(userId: number, key: string): string {
  return `user:${userId}:${key}`;
}

async function getSetting<T>(userId: number, key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const result = await getPool().query("SELECT value FROM app_settings WHERE key = $1", [settingKey(userId, key)]);
  return result.rows[0]?.value ?? fallback;
}

async function setSetting<T>(userId: number, key: string, value: T): Promise<T> {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [settingKey(userId, key), JSON.stringify(value)],
  );
  return value;
}

function rowToPost(row: any): PostItem {
  const dateValue = (value: unknown): string | undefined => {
    if (!value) return undefined;
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
    suggestedCopy: row.suggested_copy ?? undefined,
    designAssetStatus: row.design_asset_status ?? undefined,
    designDueDate: dateValue(row.design_due_date),
    reminderSent: row.reminder_sent,
  };
}

export async function getUserById(userId: number): Promise<AuthUser | null> {
  await ensureSchema();
  const result = await getPool().query("SELECT id, email, name FROM users WHERE id = $1", [userId]);
  return result.rows[0] ?? null;
}

export async function createUser(email: string, password: string, name: string): Promise<AuthUser> {
  await ensureSchema();
  const normalizedEmail = email.trim().toLowerCase();
  const result = await getPool().query(
    `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name
    `,
    [normalizedEmail, hashPassword(password), name.trim() || normalizedEmail.split("@")[0]],
  );
  return result.rows[0];
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  await ensureSchema();
  const result = await getPool().query("SELECT id, email, name, password_hash FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function getPosts(userId: number): Promise<PostItem[]> {
  await ensureSchema();
  const result = await getPool().query(
    "SELECT * FROM posts WHERE user_id = $1 ORDER BY post_date ASC, post_time ASC, created_at ASC",
    [userId],
  );
  return result.rows.map(rowToPost);
}

export async function replacePosts(userId: number, posts: PostItem[]): Promise<PostItem[]> {
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
          userId,
        ],
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

export async function upsertPost(userId: number, post: PostItem): Promise<PostItem> {
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
      userId,
    ],
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
        userId,
      ],
    );
  }

  const result = await getPool().query("SELECT * FROM posts WHERE id = $1 AND user_id = $2", [post.id, userId]);
  return rowToPost(result.rows[0]);
}

export async function patchPost(userId: number, id: string, patch: Partial<PostItem>): Promise<PostItem> {
  const existing = (await getPosts(userId)).find((post) => post.id === id);
  if (!existing) throw new Error("Post not found.");
  return upsertPost(userId, { ...existing, ...patch, id });
}

export async function getBrandKit(userId: number): Promise<BrandKit> {
  return getSetting(userId, "brandKit", defaultBrandKit);
}

export async function setBrandKit(userId: number, brandKit: BrandKit): Promise<BrandKit> {
  return setSetting(userId, "brandKit", brandKit);
}

export async function getSheetsConfig(userId: number): Promise<SheetsConfig> {
  return getSetting(userId, "sheetsConfig", defaultSheetsConfig);
}

export async function setSheetsConfig(userId: number, config: SheetsConfig): Promise<SheetsConfig> {
  return setSetting(userId, "sheetsConfig", config);
}

export async function seedIfEmpty(userId: number): Promise<void> {
  const posts = await getPosts(userId);
  if (posts.length === 0) {
    await replacePosts(userId, createSamplePosts());
  }
}

export async function getAppState(userId: number): Promise<AppState> {
  await seedIfEmpty(userId);
  const [posts, brandKit, sheetsConfig] = await Promise.all([getPosts(userId), getBrandKit(userId), getSheetsConfig(userId)]);

  return {
    posts,
    brandKit,
    sheetsConfig,
    notificationsEnabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  };
}

export async function savePushSubscription(userId: number, id: string, subscription: unknown): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO push_subscriptions (id, user_id, subscription)
      VALUES ($1, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET user_id = EXCLUDED.user_id, subscription = EXCLUDED.subscription
    `,
    [id, userId, JSON.stringify(subscription)],
  );
}

export async function getPushSubscriptions(): Promise<any[]> {
  await ensureSchema();
  const result = await getPool().query("SELECT user_id, subscription FROM push_subscriptions ORDER BY created_at ASC");
  return result.rows;
}

export async function getDueReminderPosts(now = new Date()): Promise<PostItem[]> {
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
    [today, currentTime],
  );
  return result.rows.map((row) => ({ ...rowToPost(row), userId: row.user_id } as PostItem & { userId: number }));
}

export async function markReminderSent(postId: string): Promise<void> {
  await ensureSchema();
  await getPool().query("UPDATE posts SET reminder_sent = TRUE, updated_at = NOW() WHERE id = $1", [postId]);
}
