// 玻璃邊緣的高光：整個畫面共用一個光源，跟著滑鼠走；沒在動滑鼠（或是用手機）時自己慢慢飄。
//
// 光源位置寫在每張卡片自己身上（卡片裡的座標），而且只更新光照得到的卡片。
// 不寫在 <html> 上、也不用 background-attachment: fixed：那樣每動一下滑鼠整頁都要重算樣式，
// 捲動時每張卡片都要重畫，低效能的電腦和 Safari 會很卡。

/** 光照得到的距離（px）：表面反光是 520px 的圓、65% 之後就透明了 */
const REACH = 340;
/** 自己飄的時候每秒更新幾次：移動很慢，不用每一幀都畫 */
const IDLE_FPS = 20;
/** 自己飄一趟要幾秒（來回各一趟） */
const IDLE_SECONDS = 18;
/** 自己飄的路線（畫面寬高的比例）和到達的時間點 */
const PATH: [at: number, x: number, y: number][] = [
  [0, 0.18, 0.06],
  [0.35, 0.72, 0.22],
  [0.7, 0.48, 0.64],
  [1, 0.12, 0.8],
];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** 自己飄的光源在 time 毫秒時的位置 */
function idlePoint(time: number): [number, number] {
  const cycle = (time / 1000 / IDLE_SECONDS) % 2;
  const t = cycle > 1 ? 2 - cycle : cycle;
  let i = 1;
  while (i < PATH.length - 1 && PATH[i][0] < t) i++;
  const [a0, ax, ay] = PATH[i - 1];
  const [a1, bx, by] = PATH[i];
  const k = smooth((t - a0) / (a1 - a0));
  return [(ax + (bx - ax) * k) * window.innerWidth, (ay + (by - ay) * k) * window.innerHeight];
}

export function initPointerLight() {
  const cards = [...document.querySelectorAll<HTMLElement>(".glass")];
  if (cards.length === 0) return;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  /** 上次有寫光源位置的卡片：離開光照範圍時要再寫最後一次，高光才會完全退掉 */
  const lit = new WeakSet<HTMLElement>();

  let x = window.innerWidth * 0.3;
  let y = window.innerHeight * 0.12;
  let idle = true;
  let raf = 0;
  let last = 0;

  const paint = () => {
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const near = dx * dx + dy * dy < REACH * REACH;
      if (!near && !lit.has(card)) continue;
      card.style.setProperty("--mx", `${Math.round(x - rect.left)}px`);
      card.style.setProperty("--my", `${Math.round(y - rect.top)}px`);
      if (near) lit.add(card);
      else lit.delete(card);
    }
  };

  const frame = (time: number) => {
    raf = 0;
    if (idle) {
      if (reduce.matches) return paint();
      if (time - last >= 1000 / IDLE_FPS) {
        last = time;
        [x, y] = idlePoint(time);
        paint();
      }
      raf = requestAnimationFrame(frame);
      return;
    }
    paint();
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // 卡片跟著頁面捲動、光源不會，所以捲動時要重新算卡片裡的位置
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("page:shift", schedule);
  window.addEventListener("resize", schedule, { passive: true });
  reduce.addEventListener("change", schedule);
  schedule();
  if (!fine.matches) return;

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      idle = false;
      x = e.clientX;
      y = e.clientY;
      schedule();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    idle = true;
    schedule();
  });
}
