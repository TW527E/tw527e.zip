// 看這台裝置跑不跑得動完整的玻璃效果。
//
// 預設全部開。捲動或移動滑鼠時如果一直掉幀，就換成輕量模式（<html class="lite">）：
// 不做邊緣折射，只留一般的毛玻璃。只會換一次（折射淡出），也會記住幾個小時，
// 這段時間打開直接用輕量模式，不會在完整和輕量之間換來換去。
// 頁尾的按鈕可以自己切換；自己選過就照選的，不再自動偵測。

const KEY = "perf-lite";
/** 自己選的模式（"lite" / "full"） */
const CHOICE_KEY = "perf-mode";
/** 自動換成輕量模式之後記住多久，之後重新測一次（可能只是當時剛好很忙） */
const REMEMBER_HOURS = 5;
/** 每次看幾幀 */
const WINDOW = 40;
/** 比這個慢的一幀算掉幀（ms）：低於大約 50fps，或比螢幕正常的一幀慢 1.7 倍 */
const SLOW_MS = 20;
const SLOW_RATIO = 1.7;
/** 一次裡面掉幀超過幾成算跑不動 */
const SLOW_SHARE = 0.3;
/** 連續幾次跑不動才換，免得剛載入或剛好在忙的時候被誤判 */
const STRIKES = 2;
/** 最後一次捲動或移動滑鼠之後，再看多久（ms） */
const ACTIVE_MS = 200;

const root = document.documentElement;

export const isLite = () => root.classList.contains("lite");

function choice(): string | null {
  try {
    return localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

function remembered(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY));
    if (at && Date.now() - at < REMEMBER_HOURS * 3_600_000) return true;
    localStorage.removeItem(KEY);
  } catch {
    // 無痕模式或封鎖了網站資料：每次重新測就好
  }
  return false;
}

function goLite() {
  root.classList.add("lite");
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 同上
  }
  document.dispatchEvent(new CustomEvent("perf:lite"));
}

/** 頁尾的按鈕：自己切換輕量模式，並記住 */
export function setLite(on: boolean) {
  try {
    localStorage.setItem(CHOICE_KEY, on ? "lite" : "full");
    localStorage.removeItem(KEY);
  } catch {
    // 同上：這次切換還是有效，只是不會記住
  }
  if (on === isLite()) return;
  root.classList.toggle("lite", on);
  document.dispatchEvent(new CustomEvent(on ? "perf:lite" : "perf:full"));
}

export function initPerf() {
  const chosen = choice();
  if (chosen === "lite" || (!chosen && remembered())) {
    root.classList.add("lite");
  }
  initToggle();
  if (chosen || isLite()) return;

  /** 看過最快的一幀，大約就是螢幕的更新間隔；最多算 60Hz，免得一開始就很慢的裝置永遠測不出來 */
  let best = 1000 / 60;
  let frames: number[] = [];
  let strikes = 0;
  let active = 0;
  let last = 0;
  let raf = 0;

  const frame = (time: number) => {
    raf = 0;
    if (last) {
      const d = time - last;
      best = Math.min(best, d);
      frames.push(d);
      if (frames.length >= WINDOW) {
        const limit = Math.max(SLOW_MS, best * SLOW_RATIO);
        const share = frames.filter((x) => x > limit).length / frames.length;
        frames = [];
        strikes = share > SLOW_SHARE ? strikes + 1 : 0;
        if (strikes >= STRIKES) return goLite();
      }
    }
    if (performance.now() - active < ACTIVE_MS) {
      last = time;
      raf = requestAnimationFrame(frame);
    } else {
      // 停下來的這段時間不算，下次從頭量
      last = 0;
    }
  };
  const wake = () => {
    // 自己在頁尾選過就不再自動換
    if (isLite() || choice()) return;
    active = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  };

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse") wake();
    },
    { passive: true },
  );
}

function initToggle() {
  const button = document.querySelector<HTMLButtonElement>("[data-lite-toggle]");
  if (!button) return;
  const label = button.querySelector("[data-lite-state]");
  const sync = () => {
    button.setAttribute("aria-pressed", String(isLite()));
    if (label) label.textContent = isLite() ? "開" : "關";
  };
  button.addEventListener("click", () => {
    setLite(!isLite());
    sync();
  });
  document.addEventListener("perf:lite", sync);
  sync();
}
