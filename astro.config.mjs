// @ts-check
import { defineConfig } from "astro/config";
import pkg from "./package.json" with { type: "json" };

// 只注入版本號，不把整份 package.json 打包進前端
const { version } = pkg;

export default defineConfig({
  site: "https://tw527e.zip",
  trailingSlash: "ignore",
  build: {
    // CSS 一律輸出成檔案，CSP 就不需要 'unsafe-inline'
    inlineStylesheets: "never",
  },
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      // 腳本也不要內嵌成 data: 或 inline
      assetsInlineLimit: 0,
    },
  },
});
