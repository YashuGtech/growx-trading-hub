// Server-only helpers for GrowX: DB access, password hashing, sessions, email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const db = supabaseAdmin;

// ---------- Password (PBKDF2 via Web Crypto — works on Cloudflare Workers) ----------
const PBKDF2_ITER = 100_000;
const enc = new TextEncoder();

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as any, iterations: PBKDF2_ITER },
    key,
    256,
  );
  return new Uint8Array(bits);
}
function b64(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function ub64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pw, salt);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(hash)}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  try {
    const [, iter, saltB64, hashB64] = stored.split("$");
    if (!saltB64 || !hashB64) return false;
    const salt = ub64(saltB64);
    const expected = ub64(hashB64);
    const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt as any, iterations: Number(iter) },
      key, 256,
    ));
    if (bits.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}

// ---------- OTP / random ID ----------
export function randomCode(n = 6): string {
  const buf = crypto.getRandomValues(new Uint8Array(n));
  let out = "";
  for (const b of buf) out += (b % 10).toString();
  return out;
}
export function randomToken(len = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomTradeId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of buf) s += chars[b % chars.length];
  return `FNX-${s}`;
}
export function randomPassword(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (const b of buf) s += chars[b % chars.length];
  return s;
}

// ---------- Cookies / sessions ----------
export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const p of raw.split(";")) {
    const [k, v] = p.trim().split("=");
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}
export function cookieHeader(name: string, value: string, maxAgeSec = 60 * 60 * 24 * 7): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  return attrs.join("; ");
}
export function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await db.from("sessions").insert({ token, user_id: userId, expires_at: expires });
  return token;
}
export async function getUserFromRequest(req: Request) {
  const token = readCookie(req, "gx_session");
  if (!token) return null;
  const { data } = await db.from("sessions").select("user_id, expires_at").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string) < new Date()) return null;
  const { data: user } = await db.from("users").select("*").eq("id", data.user_id).maybeSingle();
  return user;
}
export async function createTradeSession(tradeAccountId: number): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await db.from("trade_sessions").insert({ token, trade_account_id: tradeAccountId, expires_at: expires });
  return token;
}
export async function getTradeAccountFromRequest(req: Request) {
  const token = readCookie(req, "gx_trade_session");
  if (!token) return null;
  const { data } = await db.from("trade_sessions").select("trade_account_id, expires_at").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string) < new Date()) return null;
  const { data: acc } = await db.from("trade_accounts").select("*").eq("id", data.trade_account_id).maybeSingle();
  return acc;
}

// ---------- Email via SMTP2GO ----------
export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  const apiKey = process.env.SMTP2GO_API_KEY;
  const from = process.env.SMTP2GO_FROM_EMAIL || "support@growxofficial.com";
  if (!apiKey) {
    // Queue it and log — don't fail flow if key missing.
    await db.from("email_queue").insert({
      to_email: opts.to, subject: opts.subject, body: opts.html, template: "raw",
      status: "queued", error: "SMTP2GO_API_KEY not set",
    });
    return { ok: false, reason: "no_api_key" };
  }
  const payload = {
    api_key: apiKey,
    to: [opts.to],
    sender: from,
    subject: opts.subject,
    html_body: opts.html,
    text_body: opts.text || opts.html.replace(/<[^>]+>/g, ""),
  };
  try {
    const res = await fetch("https://api.smtp2go.com/v3/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    const ok = res.ok;
    await db.from("email_queue").insert({
      to_email: opts.to, subject: opts.subject, body: opts.html, template: "smtp2go",
      status: ok ? "sent" : "failed", sent_at: ok ? new Date().toISOString() : null,
      error: ok ? null : body.slice(0, 500),
    });
    return { ok, body };
  } catch (e: any) {
    await db.from("email_queue").insert({
      to_email: opts.to, subject: opts.subject, body: opts.html, template: "smtp2go",
      status: "failed", error: String(e).slice(0, 500),
    });
    return { ok: false, reason: "network" };
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}
