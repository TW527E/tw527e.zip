// 彈幕：把留言從右到左飄過整個畫面。浮在內容上面，但點不到（點擊會穿過去）。
// 可以用留言板上的「彈幕」按鈕關掉，會記住；要求減少動態效果時預設關閉。
import { guestbook } from "../config/guestbook";

/** 每秒飄多少 px（大家同速，才不會互相追撞） */
const SPEED = 90;
/** 一條軌道的高度：有署名的彈幕是兩行 */
const LANE_HEIGHT = 58;
/** 最上面那條軌道離畫面頂端多遠，避開頁首 */
const TOP = 78;
/** 同一條軌道上兩則之間的距離（px） */
const GAP = 48;
/** 平均多久冒一則（ms） */
const INTERVAL = 2600;
/** 畫面上最多同時幾則 */
const MAX_ON_SCREEN = 8;
const STORAGE_KEY = "danmaku";

interface Item {
  text: string;
  name?: string;
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function readPref(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === "on";
  } catch {
    return null;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // 無痕模式之類的存不了也沒關係
  }
}

export function initDanmaku() {
  if (!guestbook.enabled) return;
  const toggle = document.getElementById("danmaku-toggle") as HTMLButtonElement | null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const layer = document.createElement("div");
  layer.className = "danmaku";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  let messages: Item[] = [];
  let queue: Item[] = [];
  /** 正在畫面上飄的留言；留言少的時候同一則不要同時出現好幾次 */
  const active = new Set<Item>();
  let lanes: number[] = [];
  let timer = 0;
  let on = readPref() ?? !reduce.matches;

  const laneCount = () => Math.max(3, Math.floor((window.innerHeight - TOP - 24) / LANE_HEIGHT));

  /** 找一條現在可以放的軌道，沒有就回傳 -1 */
  const freeLane = (now: number) => {
    const count = laneCount();
    if (lanes.length !== count) lanes = Array.from({ length: count }, (_, i) => lanes[i] ?? 0);
    const free = lanes.map((at, i) => (at <= now ? i : -1)).filter((i) => i >= 0);
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  };

  const spawn = (item: Item, own = false) => {
    const now = performance.now();
    if (active.has(item) || layer.childElementCount >= MAX_ON_SCREEN) return false;
    const lane = freeLane(now);
    if (lane < 0) return false;
    const el = document.createElement("span");
    el.className = `danmaku__item${own ? " danmaku__item--own" : ""}`;
    const text = document.createElement("span");
    text.className = "danmaku__text";
    text.textContent = item.text;
    el.append(text);
    if (item.name) {
      const name = document.createElement("span");
      name.className = "danmaku__name";
      name.textContent = `—— ${item.name}`;
      el.append(name);
    }
    el.style.top = `${TOP + lane * LANE_HEIGHT}px`;
    layer.append(el);
    const width = el.offsetWidth;
    const start = window.innerWidth;
    const distance = start + width;
    lanes[lane] = now + ((width + GAP) / SPEED) * 1000;
    const anim = el.animate([{ transform: `translateX(${start}px)` }, { transform: `translateX(${-width}px)` }], {
      duration: (distance / SPEED) * 1000,
      easing: "linear",
    });
    active.add(item);
    anim.onfinish = () => {
      el.remove();
      active.delete(item);
    };
    return true;
  };

  const tick = () => {
    timer = window.setTimeout(tick, INTERVAL * (0.6 + Math.random() * 0.8));
    if (document.hidden || messages.length === 0) return;
    if (queue.length === 0) queue = shuffle(messages);
    // 排在前面但還在畫面上的先跳過，等它飄完
    const next = queue.findIndex((item) => !active.has(item));
    if (next >= 0 && spawn(queue[next])) queue.splice(next, 1);
  };

  const start = () => {
    if (!timer) tick();
    for (const anim of layer.getAnimations({ subtree: true })) anim.play();
  };

  const stop = () => {
    clearTimeout(timer);
    timer = 0;
    layer.replaceChildren();
    active.clear();
    lanes = [];
  };

  const setOn = (value: boolean) => {
    on = value;
    toggle?.setAttribute("aria-pressed", String(on));
    if (toggle) toggle.title = on ? "關掉彈幕" : "打開彈幕";
    if (on) start();
    else stop();
  };

  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      setOn(!on);
      writePref(on);
    });
  }

  // 分頁切到背景時先暫停，回來再繼續
  document.addEventListener("visibilitychange", () => {
    for (const anim of layer.getAnimations({ subtree: true })) {
      if (document.hidden) anim.pause();
      else anim.play();
    }
  });

  // 自己剛留的話馬上飄出來，也加進輪播
  document.addEventListener("danmaku:add", (e) => {
    const { text, name } = (e as CustomEvent<Item>).detail;
    const item: Item = { text, name };
    messages.unshift(item);
    if (on && !spawn(item, true)) queue.unshift(item);
  });

  setOn(on);

  // 等頁面其他東西都載完再去拿留言，不跟首屏搶網路
  const load = async () => {
    try {
      const res = await fetch(guestbook.api);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: Item[] };
      messages = [...(data.messages ?? []).map((m) => ({ text: m.text, name: m.name })), ...messages];
    } catch {
      // 拿不到就沒有彈幕，頁面照常
    }
  };
  if (document.readyState === "complete") void load();
  else window.addEventListener("load", () => void load(), { once: true });
}
