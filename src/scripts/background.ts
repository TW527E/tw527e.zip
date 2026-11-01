import { background, type BackgroundImage } from "../config/background";
import { currentTone, onToneChange, type Tone } from "./theme";

let current: BackgroundImage | null = null;

/** 跟 CSS 的手機版面同一個斷點 */
const mobileLayout = window.matchMedia("(max-width: 959px)");
const currentDevice = () => (mobileLayout.matches ? "mobile" : "desktop");
/** 沒指定 device 的圖兩種版面都能用 */
const fits = (img: BackgroundImage) => !img.device || img.device === currentDevice();

function load(src: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    const timer = window.setTimeout(() => {
      probe.src = "";
      reject(new Error("timeout"));
    }, timeoutMs);
    probe.onload = () => {
      clearTimeout(timer);
      resolve(src);
    };
    probe.onerror = () => {
      clearTimeout(timer);
      reject(new Error("error"));
    };
    probe.src = src;
  });
}

const weightOf = (img: BackgroundImage) => Math.max(img.weight ?? 1, 0);

/** 依權重隨機挑一張 */
function weightedPick(pool: BackgroundImage[]): BackgroundImage | null {
  const total = pool.reduce((sum, img) => sum + weightOf(img), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const img of pool) {
    roll -= weightOf(img);
    if (roll < 0) return img;
  }
  return pool[pool.length - 1];
}

/** 只挑這個版面能用的圖；優先挑跟主題同色調的，沒有就從這些裡挑 */
function pickLocal(tone: Tone, exclude?: string): BackgroundImage | null {
  const others = background.local.filter((img) => img.src !== exclude && fits(img) && weightOf(img) > 0);
  const matched = others.filter((img) => img.tone === tone);
  return weightedPick(matched.length > 0 ? matched : others);
}

/** 依設定挑一張背景，失敗就一路退回；全部失敗回傳 null（只剩底色） */
async function pick(tone: Tone, exclude?: string): Promise<BackgroundImage | null> {
  const candidates: { img: BackgroundImage; timeout?: number }[] = [];
  if (background.provider === "remote" && background.remote.url) {
    // 加上時間戳避免同一張被快取
    const url = new URL(background.remote.url);
    url.searchParams.set("_", Date.now().toString());
    candidates.push({ img: { src: url.href, tone }, timeout: background.remote.timeoutMs });
  }
  const local = pickLocal(tone, exclude);
  if (local) candidates.push({ img: local });
  candidates.push({ img: { src: background.fallback[tone], tone } });

  for (const { img, timeout } of candidates) {
    try {
      await load(img.src, timeout);
      return img;
    } catch {
      // 換下一個
    }
  }
  return null;
}

async function show(exclude?: string) {
  const el = document.getElementById("bg-img") as HTMLImageElement | null;
  if (!el) return;
  const img = await pick(currentTone(), exclude);
  if (!img) return;
  if (current) {
    // 先淡出再換圖，比較不突兀
    el.classList.remove("is-loaded");
    await new Promise((r) => setTimeout(r, 300));
  }
  el.src = img.src;
  current = img;
  el.classList.add("is-loaded");
  // 給 liquid glass 的背景副本（Safari、Firefox）跟著換圖
  document.dispatchEvent(new CustomEvent("bg:change"));
}

export function initBackground() {
  void show();
  document.addEventListener("bg:shuffle", () => void show(current?.src));
  // 換主題後，如果現在這張色調不搭就換一張
  onToneChange((tone) => {
    if (current && current.tone !== tone) void show(current.src);
  });
  // 視窗縮放跨過手機／電腦版面時，如果現在這張是另一種版面專用的就換一張
  mobileLayout.addEventListener("change", () => {
    if (current && !fits(current)) void show(current.src);
  });
}
