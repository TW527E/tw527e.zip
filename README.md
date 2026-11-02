# tw527e.zip

誠誠（ChengCheng）的個人主頁 → <https://tw527e.zip>

用 [Astro](https://astro.build/) 做的純靜態網站，介面是帶一點 liquid glass 感覺的玻璃卡片。

- 個人簡介、社群連結、聯絡方式（點一下就能複製）
- 我的其他地方（部落格、網站狀態）
- 我在經營的 Minecraft 伺服器 Lunlun's World
- 做過的東西（GitHub 專案精選）
- 時間膠囊（今天／這週／這個月／今年過了多少）
- 淺色／深色主題、隨機背景、只看背景模式

## 開發

需要 Node.js 22 以上和 pnpm（版本寫在 `package.json` 的 `packageManager`）。

```bash
pnpm install
pnpm dev          # 只在本機開：http://localhost:4321
pnpm dev:lan      # 要用手機在同一個網路測試時才用
pnpm check        # 型別檢查
pnpm build        # 輸出到 dist/
pnpm preview      # 預覽 build 結果
pnpm dev:api      # 連留言 API 一起跑（要先 pnpm build），http://localhost:8788
```

`pnpm dev:api` 用 wrangler 在本機跑跟線上一樣的 Worker（靜態檔案 + 留言 API），留言會存在本機的 `.wrangler/`。第一次用之前先把 `.dev.vars.example` 複製成 `.dev.vars`，裡面是 Cloudflare 公開的 Turnstile 測試用 secret（永遠會通過，只能本機用）。

## 要改內容的話

內容都集中在 `src/config/`，改這裡就好，不用動元件：

| 檔案 | 內容 |
| --- | --- |
| `site.ts` | 名字、簡介、標籤、Email、網站開站日期 |
| `links.ts` | 社群連結、聯絡方式、「我的其他地方」 |
| `guestbook.ts` | 留言板開關、Turnstile 的 site key（見下面「留言板和彈幕」） |
| `minecraft.ts` | Minecraft 伺服器卡片 |
| `projects.ts` | 「做過的東西」；Logo 圖放 `src/assets/projects/`，沒有 Logo 的可以挑一個 Lucide 圖示 |
| `background.ts` | 背景圖清單；之後想接隨機圖 API，把 `provider` 改成 `"remote"` 並填 `remote.url` |

背景圖放在 `public/bg/`，每張要標記 `tone`（`light` 或 `dark`），淺色主題會優先挑亮的圖、深色主題挑暗的圖。想讓某張圖只在手機版面（959px 以下）或電腦版面出現，再加上 `device: "mobile"` 或 `device: "desktop"`；不加就兩邊都會出現。想讓某張比較常出現，加上 `weight`（預設 1，2 就是兩倍機會，0 是不會被隨機挑到）。

## 玻璃邊緣的折射

桌機寬度（960px 以上）時，卡片邊緣會把背景往內折，像透過厚玻璃在看（`src/scripts/liquid.ts`）。

- 位移貼圖是 `public/glass/` 裡事先做好的碎片（四個圓角 + 四條邊），依卡片尺寸拼起來。想改圓角或折射帶寬度，改 `scripts/make-glass-maps.mjs` 的設定後執行 `node scripts/make-glass-maps.mjs` 重新產生，再把 `liquid.ts` 裡對應的常數一起改掉。
- Chrome、Edge、Vivaldi 等 Chromium 瀏覽器直接用 `backdrop-filter` 套 SVG 濾鏡。
- Safari、Firefox 的 `backdrop-filter` 不支援 SVG 濾鏡，所以改在卡片裡放一份對齊畫面的背景副本（畫在 `<svg>` 裡），對副本做折射和模糊。
- 手機、或系統開了「減少透明度」時不做折射，只留一般的毛玻璃。

## 部署到 Cloudflare Workers

網頁是 Astro 產生的靜態檔案，加上一個很小的 Worker（`worker/`）處理留言 API。設定都在 `wrangler.jsonc`：

- 靜態檔案（網頁、圖片、CSS、JS）由 Cloudflare 直接回應，免費、不限次數。
- 只有 `/api/*` 會跑 Worker，算進免費方案每天 10 萬次的額度。
- `public/_headers` 一樣會套用，裡面有 CSP 和其他安全標頭；如果之後背景改用外部 API，記得把那個網域加進 `img-src`。
- `public/sw.js` 不要刪：舊主頁在訪客瀏覽器裝了 Service Worker，會一直顯示舊網頁。這份會把它換掉、清快取、取消註冊，再自動重新整理成新網站。

第一次部署：

1. Cloudflare 後台 → **Workers & Pages** → **Create** → **Continue with GitHub**，選這個 repo。
2. 設定：
   - Project name：`tw527e-zip`（要跟 `wrangler.jsonc` 的 `name` 一樣）
   - Build command：`pnpm build`
   - Deploy command：`npx wrangler deploy`
   - Advanced settings 最下面的 Variable name / Variable value（建置用的環境變數）：`NODE_VERSION` = `22`、`PNPM_VERSION` = `12.16.1`，不用勾 Encrypt
   - API token 那欄讓它自動建立就好，那是給 Cloudflare 自己部署用的，不用存起來。
3. 按 **Deploy**。第一次部署時，wrangler 會自動建立 D1 資料庫 `tw527e-zip-db` 並綁定成 `DB`。
4. 部署完成後，到 Worker 的 **Settings** → **Domains & Routes** → **Add** → **Custom domain**，填 `tw527e.zip`。

之後每次推送到 `main` 就會自動部署。

## 搜尋引擎和 AI（SEO / GEO）

下面這些都是 build 時從 `src/config/` 產生的，改設定就會跟著變，不用另外維護：

| 網址 | 給誰看 | 產生它的檔案 |
| --- | --- | --- |
| `/llms.txt` | ChatGPT、Claude、Perplexity 這類 AI（格式見 [llmstxt.org](https://llmstxt.org/)） | `src/pages/llms.txt.ts` |
| `/robots.txt` | 所有爬蟲：全部歡迎，只擋 `/api/` | `src/pages/robots.txt.ts` |
| `/sitemap.xml` | 搜尋引擎 | `src/pages/sitemap.xml.ts` |
| 首頁裡的 JSON-LD | 搜尋引擎和 AI：說明這是誰的個人主頁、哪些帳號是同一個人 | `src/pages/index.astro` |

另外 404 頁設了 `noindex`，不會被收錄。

上線後可以做的事：

- 到 [Google Search Console](https://search.google.com/search-console) 和 [Bing Webmaster Tools](https://www.bing.com/webmasters) 加入網站、送出 `https://tw527e.zip/sitemap.xml`。驗證用 DNS 紀錄最方便（DNS 在 Cloudflare）。
- 想讓 AI 找得到你，記得看一下 Cloudflare 後台 → 網域 → **Security** → **Bots**：如果開了「Block AI bots」或「Manage your robots.txt」，Cloudflare 會擋掉 AI 爬蟲、或在 robots.txt 前面加上禁止 AI 的規則，`llms.txt` 就沒人看得到了。

## 留言板和彈幕

左欄的「留一句話」：訪客留一句話（最多 30 字），會變成彈幕從背景飄過去。後端是 `worker/messages.ts`（Cloudflare Workers），留言存在 Cloudflare D1，送出時用 Cloudflare Turnstile 擋機器人。都在免費額度內，不用錢。

- Turnstile 的程式只在按下「送出」時才載入，不會拖慢首頁。
- 會擋掉：超過 30 字、連結、髒話和廣告詞（清單在 `worker/filter.ts`，想加就往裡面加）。
- 同一個人兩則之間要隔 1 分鐘、一天最多 5 則。不存 IP，只存每天會換的雜湊。
- 留言清單在 Cloudflare 邊緣快取 30 秒，再多人同時看也幾乎不會讀到資料庫；有人留言時會清掉快取。
- 訪客可以用「彈幕」按鈕關掉彈幕；系統要求減少動態效果時預設關閉。
- 不想要留言板：把 `src/config/guestbook.ts` 的 `enabled` 改成 `false`。

### 第一次設定（都在 Cloudflare 後台點）

1. **Turnstile**：左側選單 **Turnstile** → **Add widget**，Hostname 填 `tw527e.zip`，模式選 **Managed**。
   - 拿到的 **Site Key** 是公開的，填進 `src/config/guestbook.ts` 的 `turnstileSiteKey`（取代原本的測試用 key）。
   - **Secret Key** 不要寫進任何檔案：到 Worker `tw527e-zip` → **Settings** → **Variables and Secrets** → **Add**，類型選 **Secret**，名稱 `TURNSTILE_SECRET`，貼上去，按 **Deploy** 存檔（加密變數不會被之後的部署蓋掉）。
2. **D1** 不用自己建：第一次部署時會自動建好 `tw527e-zip-db`，資料表會在第一次有人看首頁時自動建立，不用自己跑 SQL。

還沒設定好之前，留言板會顯示「留言功能還沒設定好」，網站其他部分照常。

### 刪掉垃圾留言

到 **Storage & Databases** → **D1** → `tw527e-zip-db` → **Console**，貼上 SQL 執行：

```sql
-- 看最新的 50 則（時間是台灣時間）
SELECT id, text, datetime(created_at / 1000, 'unixepoch', '+8 hours') AS time
FROM messages ORDER BY id DESC LIMIT 50;

-- 先藏起來（之後可以把 1 改回 0 復原）
UPDATE messages SET hidden = 1 WHERE id = 42;

-- 直接刪掉
DELETE FROM messages WHERE id = 42;

-- 同一個人一次留了很多垃圾：先查他的 ip_hash，再整批刪
SELECT ip_hash, text FROM messages WHERE id = 42;
DELETE FROM messages WHERE ip_hash = '查到的那串';
```

也可以在 **Tables** 分頁直接點那一列刪掉。首頁的留言清單會快取 30 秒，刪掉後最慢 30 秒就不會再出現。

## 授權

程式碼以 [MIT](./LICENSE) 授權。

- `public/fonts/pacifico-subset.woff2` 是 [Pacifico](https://github.com/googlefonts/Pacifico) 字型的子集，以 SIL Open Font License 1.1 授權（見 `public/fonts/OFL.txt`）。
- 圖示來自 [Lucide](https://lucide.dev/)（ISC）和 [Simple Icons](https://simpleicons.org/)（CC0）。
- 頭像和背景圖是我自己的，請不要拿去用在別的地方。
