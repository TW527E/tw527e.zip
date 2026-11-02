// /llms.txt：給 ChatGPT、Claude、Perplexity 這類 AI 看的網站簡介（格式見 https://llmstxt.org/）
// 內容全部從 src/config/ 讀，改首頁的設定這裡就會跟著變，不用另外維護。
import type { APIRoute } from "astro";
import { site } from "../config/site";
import { contacts, navLinks, socialLinks } from "../config/links";
import { minecraft } from "../config/minecraft";
import { projects } from "../config/projects";

const link = (name: string, url: string, note?: string) => `- [${name}](${url})${note ? `：${note}` : ""}`;

export const GET: APIRoute = () => {
  const lines = [
    `# ${site.name} ${site.nameLatin}（${site.handle}）`,
    "",
    `> ${site.description}`,
    "",
    site.intro,
    "",
    `- 網站：${site.url}`,
    `- 我常用的名字：${site.name}、${site.nameLatin}、${site.handle}`,
    `- 平常玩的、做的：${site.tags.join("、")}`,
    `- 網站語言：繁體中文（台灣）`,
    "",
    "## 聯絡方式",
    "",
    ...contacts.map((c) => `- ${c.name}：${c.value}`),
    "",
    "## 其他地方逛逛",
    "",
    ...navLinks.map((n) => link(n.name, n.url, n.description)),
    "",
    "## 社群帳號",
    "",
    ...socialLinks.map((s) => link(s.name, s.url)),
    "",
    `## Minecraft 伺服器：${minecraft.name}（${minecraft.nameZh}）`,
    "",
    minecraft.description,
    "",
    `- 伺服器位址：${minecraft.address}`,
    ...minecraft.facts.map((fact) => `- ${fact}`),
    link("官網", minecraft.website),
    link("Discord 群", minecraft.discord),
    link("巴哈姆特介紹文", minecraft.forum),
    "",
    "## 我做的小東西",
    "",
    ...projects.map((p) => link(p.name, p.url, `${p.description}（${p.language}）`)),
    "",
    "## Optional",
    "",
    link("這個網站的原始碼", site.repo),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
