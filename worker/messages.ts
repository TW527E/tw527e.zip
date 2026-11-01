// 留言 API
//   GET  /api/messages → 最新的留言，給首頁做彈幕
//   POST /api/messages → 留一句話，要帶 Turnstile 的驗證 token
//
// 需要的設定：
//   - D1 綁定 DB：寫在 wrangler.jsonc，第一次部署時會自動建立資料庫，資料表第一次用到時自動建立
//   - 加密的環境變數 TURNSTILE_SECRET（Turnstile 的 secret key）：到 Cloudflare 後台設定，見 README

import { normalize, reject, rejectName } from "./filter";

export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  TURNSTILE_SECRET?: string;
}

/** 首頁一次拿多少則 */
const LIST_LIMIT = 200;
/**
 * 留言清單在 Cloudflare 邊緣快取幾秒。不管多少人同時開首頁，這段時間內最多只讀一次資料庫，
 * D1 的免費讀取額度就不會被吃光。有人留言時會清掉快取，新留言不用等。
 */
const LIST_CACHE_SECONDS = 30;
/** 同一個人兩則之間至少隔多久（ms） */
const COOLDOWN = 60_000;
/** 同一個人一天最多幾則 */
const DAILY_LIMIT = 5;
const DAY = 86_400_000;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    ip_hash TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0
  )`,
  "CREATE INDEX IF NOT EXISTS messages_by_ip ON messages (ip_hash, created_at)",
];

let schemaReady = false;

async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  // 舊的資料表還沒有署名欄位的話補上
  const { results } = await db.prepare("PRAGMA table_info(messages)").all<{ name: string }>();
  if (!results.some((col) => col.name === "name")) {
    await db.prepare("ALTER TABLE messages ADD COLUMN name TEXT NOT NULL DEFAULT ''").run();
  }
  schemaReady = true;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

const fail = (error: string, status: number) => json({ ok: false, error }, status);

/**
 * 不存 IP 本身，只存「IP + 日期」的雜湊，拿來限制留言頻率。
 * 每天換一次，所以隔天就沒辦法把同一個人的留言串起來。
 */
async function ipHash(ip: string, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`tw527e-guestbook:${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(secret: string, token: string, ip: string) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!res.ok) return false;
  const result = (await res.json()) as { success?: boolean };
  return result.success === true;
}

/** 邊緣快取用的 key：只看網址，不管請求帶了什麼標頭 */
const listCacheKey = (request: Request) => new Request(new URL(request.url).origin + "/api/messages", { method: "GET" });

export async function listMessages(request: Request, env: Env, ctx: ExecutionContext) {
  if (!env.DB) return fail("留言功能還沒設定好", 503);
  const cache = caches.default;
  const key = listCacheKey(request);
  const hit = await cache.match(key);
  if (hit) return hit;

  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(
    "SELECT id, text, name, created_at FROM messages WHERE hidden = 0 ORDER BY id DESC LIMIT ?",
  )
    .bind(LIST_LIMIT)
    .all<{ id: number; text: string; name: string; created_at: number }>();
  // 刪掉的留言最慢 30 秒後就不會再出現
  const res = json({ ok: true, messages: results }, 200, { "Cache-Control": `public, max-age=${LIST_CACHE_SECONDS}` });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export async function postMessage(request: Request, env: Env, ctx: ExecutionContext) {
  if (!env.DB || !env.TURNSTILE_SECRET) return fail("留言功能還沒設定好", 503);

  // 只收自己網站送來的
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return fail("不能從別的網站送出", 403);
  if (Number(request.headers.get("Content-Length") ?? 0) > 2048) return fail("內容太長了", 413);

  let body: { text?: unknown; name?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("格式不對", 400);
  }

  const text = normalize(body.text);
  const name = normalize(body.name);
  const problem = reject(text) ?? rejectName(name);
  if (problem) return fail(problem, 400);
  if (typeof body.token !== "string" || body.token.length === 0) return fail("請先完成人機驗證", 400);

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (!(await verifyTurnstile(env.TURNSTILE_SECRET, body.token, ip))) return fail("人機驗證沒通過，再試一次", 403);

  await ensureSchema(env.DB);
  const now = Date.now();
  const hash = await ipHash(ip, now);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count, MAX(created_at) AS last FROM messages WHERE ip_hash = ? AND created_at > ?")
    .bind(hash, now - DAY)
    .first<{ count: number; last: number | null }>();
  if (recent?.last && now - recent.last < COOLDOWN) return fail("留太快了，等一分鐘再來", 429);
  if ((recent?.count ?? 0) >= DAILY_LIMIT) return fail(`一天最多留 ${DAILY_LIMIT} 句，明天再來吧`, 429);

  const row = await env.DB.prepare("INSERT INTO messages (text, name, created_at, ip_hash) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(text, name, now, hash)
    .first<{ id: number }>();
  // 清掉留言清單的快取，下一個開首頁的人就看得到新留言
  ctx.waitUntil(caches.default.delete(listCacheKey(request)));
  return json({ ok: true, message: { id: row?.id, text, name, created_at: now } }, 201);
}
