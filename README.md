# tw527e.zip

誠誠（ChengCheng）的個人主頁：<https://tw527e.zip>

用 [Astro](https://astro.build/) 寫的純靜態網站，卡片做成有點 liquid glass 味道的玻璃。首頁上有：

- 自我介紹、社群連結，還有點一下就能複製的聯絡方式
- 其他地方逛逛：部落格和網站狀態頁
- 我開的 Minecraft 伺服器 Lunlun's World
- 我做的小東西（從 GitHub 挑的幾個專案）
- 時間進度：今天、這週、這個月、今年各過了多少
- 留言板，留言會變成背景上的彈幕
- 淺色／深色主題、隨機換背景、只看背景模式

## 開發

要裝 Node.js 22 以上和 pnpm，pnpm 的版本看 `package.json` 的 `packageManager`。

```bash
pnpm install
pnpm dev          # 只在本機開：http://localhost:4321
pnpm dev:lan      # 要用手機在同一個網路測試時才用
pnpm check        # 型別檢查
pnpm build        # 輸出到 dist/
pnpm preview      # 預覽 build 結果
pnpm dev:api      # 連留言 API 一起跑（要先 pnpm build），http://localhost:8788
```

`pnpm dev:api` 會用 wrangler 在本機跑一個跟線上相同的 Worker，靜態檔案和留言 API 都有，留言存在本機的 `.wrangler/` 裡。第一次跑之前，先把 `.dev.vars.example` 複製一份叫 `.dev.vars`。裡面放的是 Cloudflare 公開的 Turnstile 測試 secret，驗證一定會過，所以只能在本機用。

## 改內容

要改的內容都在 `src/config/`，元件不用碰：

| 檔案 | 內容 |
| --- | --- |
| `site.ts` | 名字、簡介、標籤、Email、開站日期 |
| `links.ts` | 社群連結、聯絡方式、「其他地方逛逛」 |
| `guestbook.ts` | 留言板要不要開、Turnstile 的 site key（設定方式在下面「留言板和彈幕」） |
| `minecraft.ts` | Minecraft 伺服器那張卡片 |
| `projects.ts` | 「我做的小東西」。Logo 放在 `src/assets/projects/`，沒有 Logo 就挑一個 Lucide 圖示 |
| `background.ts` | 背景圖清單。以後要改接隨機圖 API，就把 `provider` 改成 `"remote"`，再填 `remote.url` |

背景圖放在 `public/bg/`。每張都要標 `tone`（`light` 或 `dark`），淺色主題會先挑亮的圖，深色主題先挑暗的。只想在手機版面（959px 以下）或電腦版面出現的圖，加上 `device: "mobile"` 或 `device: "desktop"`，沒加就兩邊都會出現。`weight` 用來調出現的機率：預設是 1，設 2 機會變兩倍，設 0 就不會被隨機挑到。

## 玻璃效果

卡片中間是模糊過的背景，邊緣會把背景往內折，看起來像隔著一塊厚玻璃。

- 有 WebGL 的瀏覽器（包括手機）用 WebGL 畫，程式在 `src/scripts/liquid-gl.ts`，分成兩層：
  - 霧面：先模糊好的背景圖固定在畫面上，再裁成卡片的形狀，捲動時由瀏覽器自己對齊。
  - 邊緣：每張卡片有一個畫布，只負責邊緣那一圈的折射、色散和高光。折射強度、寬度這些設定是檔案開頭的常數。
- 在手機、Safari 和會掉幀的電腦上，捲動時邊緣那層會先淡出，停下來才畫回來。捲動跑在另一條執行緒，畫布跟不上。
- 沒有 WebGL 就改用 SVG 濾鏡（`src/scripts/liquid.ts`），而且只在桌機寬度（960px 以上）才做：
  - 位移貼圖是 `public/glass/` 裡事先做好的碎片，四個圓角加四條邊，依卡片大小拼起來。要改圓角或折射帶的寬度，先改 `scripts/make-glass-maps.mjs` 的設定，執行 `node scripts/make-glass-maps.mjs` 重新產生，再把 `liquid.ts` 裡對應的常數改成一樣。
  - Chrome、Edge、Vivaldi 這些 Chromium 瀏覽器，直接把 SVG 濾鏡套在 `backdrop-filter` 上。
  - Safari 和 Firefox 的 `backdrop-filter` 不吃 SVG 濾鏡，所以在卡片裡另外放一份跟畫面對齊的背景（畫在 `<svg>` 裡），折射和模糊都做在這份副本上。
- 系統開了「減少透明度」就不做折射，只剩普通的毛玻璃。
- 瀏覽器原生的回彈關掉了，因為它回彈時玻璃和游標會對不上。拉過頁面頭尾的回彈改由 `src/scripts/overscroll.ts` 自己做。
- 捲動或移動滑鼠時一直掉幀的裝置會自動降級（`src/scripts/perf.ts`）。WebGL 版會先改成捲動時邊緣淡出，還是太卡才換成輕量模式（不折射，只留普通毛玻璃）。每一級都會記住 5 個小時。頁尾的羽毛按鈕可以手動切換輕量模式，手動選過就照你選的，不再自動判斷。

## 部署到 Cloudflare Workers

網站是 Astro 輸出的靜態檔案，再加一個處理留言 API 的小 Worker（`worker/`），設定都寫在 `wrangler.jsonc`：

- 網頁、圖片、CSS、JS 這些靜態檔案由 Cloudflare 直接回應，免費也不限次數。
- 只有 `/api/*` 會經過 Worker，算進免費方案一天 10 萬次的額度。
- `public/_headers` 也會套用，CSP 和其他安全標頭都在裡面。之後背景如果改接外部 API，記得把那個網域加進 `img-src`。
- 別刪 `public/sw.js`。舊版主頁在訪客的瀏覽器裝過 Service Worker，不處理的話會一直顯示舊網頁。這個檔案會換掉舊的 Service Worker，清掉快取、取消註冊，再自動重新整理成新網站。

第一次部署：

1. 到 Cloudflare 後台 → **Workers & Pages** → **Create** → **Continue with GitHub**，選這個 repo。
2. 設定：
   - Project name：`tw527e-zip`（要跟 `wrangler.jsonc` 裡的 `name` 相同）
   - Build command：`pnpm build`
   - Deploy command：`npx wrangler deploy`
   - Advanced settings 最下面的 Variable name / Variable value 是建置時的環境變數，填 `NODE_VERSION` = `22` 和 `PNPM_VERSION` = `12.16.1`，Encrypt 不用勾
   - API token 讓它自動建立就好。那是 Cloudflare 自己部署時用的，不必另外保存。
3. 按 **Deploy**。第一次部署時，wrangler 會自動建好 D1 資料庫 `tw527e-zip-db`，並綁定成 `DB`。
4. 部署好之後，到 Worker 的 **Settings** → **Domains & Routes** → **Add** → **Custom domain**，填入 `tw527e.zip`。

之後只要推到 `main` 就會自動部署。

## 搜尋引擎和 AI（SEO / GEO）

這些都是 build 時從 `src/config/` 產生的，設定改了就會跟著更新：

| 網址 | 給誰讀 | 由哪個檔案產生 |
| --- | --- | --- |
| `/llms.txt` | ChatGPT、Claude、Perplexity 這類 AI（格式參考 [llmstxt.org](https://llmstxt.org/)） | `src/pages/llms.txt.ts` |
| `/robots.txt` | 所有爬蟲：全部都能爬，只有 `/api/` 不行 | `src/pages/robots.txt.ts` |
| `/sitemap.xml` | 搜尋引擎 | `src/pages/sitemap.xml.ts` |
| 首頁的 JSON-LD | 搜尋引擎和 AI：告訴它們這是誰的主頁、哪些帳號是同一個人 | `src/pages/index.astro` |

404 頁有設 `noindex`，不會被收錄。

上線後還可以做兩件事：

- 到 [Google Search Console](https://search.google.com/search-console) 和 [Bing Webmaster Tools](https://www.bing.com/webmasters) 加入網站，送出 `https://tw527e.zip/sitemap.xml`。驗證網站用 DNS 紀錄最快，DNS 本來就在 Cloudflare。
- 想讓 AI 找得到這個網站，要去 Cloudflare 後台 → 網域 → **Security** → **Bots** 看一下。只要開了「Block AI bots」或「Manage your robots.txt」，Cloudflare 就會擋掉 AI 爬蟲，或在 robots.txt 前面加上禁止 AI 的規則，這樣 `llms.txt` 就沒有 AI 讀得到了。

## 留言板和彈幕

訪客可以在左欄的「留句話給我」留一句話，最多 30 個字，送出後會變成彈幕從背景飄過。後端是 `worker/messages.ts`，跑在 Cloudflare Workers 上，留言存在 Cloudflare D1，送出時用 Cloudflare Turnstile 擋機器人。這些都在免費額度內。

- 要按下「送出」才會載入 Turnstile 的程式，首頁不會因此變慢。
- 超過 30 字、有連結、有髒話或廣告詞的留言會被擋下來。字詞清單在 `worker/filter.ts`，要加直接加。
- 同一個人每則留言要隔 1 分鐘，一天最多 5 則。IP 不會存，只存每天更換的雜湊值。
- 留言清單會在 Cloudflare 邊緣快取 30 秒，就算很多人同時在看，也幾乎不會讀到資料庫。有新留言時會清掉快取。
- 訪客可以按「彈幕」按鈕關掉彈幕。系統設定要減少動態效果的話，彈幕預設就是關的。
- 不要留言板的話，把 `src/config/guestbook.ts` 的 `enabled` 改成 `false`。

### 第一次設定（全部在 Cloudflare 後台操作）

1. **Turnstile**：左側選單選 **Turnstile** → **Add widget**，Hostname 填 `tw527e.zip`，模式選 **Managed**。
   - 拿到的 **Site Key** 可以公開，填到 `src/config/guestbook.ts` 的 `turnstileSiteKey`，換掉原本的測試 key。
   - **Secret Key** 不能寫進任何檔案。到 Worker `tw527e-zip` → **Settings** → **Variables and Secrets** → **Add**，類型選 **Secret**，名稱填 `TURNSTILE_SECRET`，貼上後按 **Deploy** 儲存。加密變數不會被之後的部署蓋掉。
2. **D1** 不用手動建立。第一次部署就會自動建好 `tw527e-zip-db`，資料表則是在第一次有人打開首頁時自動建立，不用自己跑 SQL。

設定完成前，留言板會顯示「留言板還沒設定好」，網站其他部分不受影響。

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

也可以到 **Tables** 分頁直接點那一列刪除。首頁的留言清單有 30 秒快取，刪掉之後最多 30 秒就會消失。

## 授權

程式碼採用 [MIT](./LICENSE) 授權。

- `public/fonts/pacifico-subset.woff2` 是 [Pacifico](https://github.com/googlefonts/Pacifico) 字型的子集，採用 SIL Open Font License 1.1（見 `public/fonts/OFL.txt`）。
- 圖示來自 [Lucide](https://lucide.dev/)（ISC）和 [Simple Icons](https://simpleicons.org/)（CC0）。
- 頭像和背景圖都是我的，請不要拿去別的地方用。
