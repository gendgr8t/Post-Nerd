import crypto from "crypto";
import { HandlerRequest, HandlerResponse } from "./http.ts";

const COOKIE_NAME = "post_nerd_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "post-nerd-local-dev-secret";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
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
    const actual = crypto.pbkdf2Sync(password, salt, 100000, Math.max(32, expected.length / 2), "sha512").toString("hex");
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }

  return false;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: number): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(req: HandlerRequest): number | null {
  const cookieHeader = String(req.headers?.cookie || "");
  const cookie = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return Number(parsed.userId);
  } catch {
    return null;
  }
}

export function setSessionCookie(res: HandlerResponse, userId: number) {
  res.setHeader?.(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}

export function clearSessionCookie(res: HandlerResponse) {
  res.setHeader?.("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
