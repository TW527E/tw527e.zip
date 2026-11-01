// /robots.txt：歡迎所有搜尋引擎和 AI 爬蟲，順便告訴它們 sitemap 和 llms.txt 在哪
import type { APIRoute } from "astro";
import { site } from "../config/site";

export const GET: APIRoute = () => {
  const text = [
    "User-agent: *",
    "Allow: /",
    // 留言 API 沒什麼好收錄的
    "Disallow: /api/",
    "",
    `Sitemap: ${new URL("/sitemap.xml", site.url).href}`,
    `# 給 AI 看的網站簡介：${new URL("/llms.txt", site.url).href}`,
    "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
