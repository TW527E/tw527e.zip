// Worker 入口。網頁、圖片這些靜態檔案由 Cloudflare 直接回應，不會跑到這裡（也不算請求次數）；
// 只有 /api/* 會進來（見 wrangler.jsonc 的 run_worker_first）。
import { listMessages, postMessage, type Env } from "./messages";

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/messages") {
      if (request.method === "GET") return listMessages(request, env, ctx);
      if (request.method === "POST") return postMessage(request, env, ctx);
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
    }
    if (pathname.startsWith("/api/")) return new Response("Not Found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
