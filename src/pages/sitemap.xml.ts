// /sitemap.xml：告訴搜尋引擎這個網站有哪些頁面。只有首頁，所以手寫就好，不用另外裝套件。
import type { APIRoute } from "astro";
import { site } from "../config/site";

const pages = ["/"];

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = pages.map((path) => `  <url>\n    <loc>${new URL(path, site.url).href}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
