// 拉過頁面頭尾的回彈，自己做。
//
// 瀏覽器原生的回彈關掉了（global.css 的 overscroll-behavior）：彈的時候 Chrome 不會告訴網頁頁面移了多少、
// Safari 連背景都一起推走，玻璃和游標都會對不上。
// 自己做的話，頁面移多少是這裡算的，算完馬上發 page:shift，玻璃在同一幀跟著重畫；滑鼠滾輪捲到底也會彈一下。
//
// 用 position: relative 的 top 移動頁面，不用 transform：transform 會讓卡片裡 position: fixed 的霧面層對不準畫面。

/** 最多拉多遠（px） */
const MAX = 120;
/** 滾輪拉的手感：越小越難拉 */
const WHEEL_PULL = 0.4;
/** 手指拉的手感 */
const TOUCH_PULL = 0.55;
/** 多久沒有新的滾輪事件就開始彈回去（ms）：觸控板的事件大約 16ms 一個 */
const HOLD = 80;
/** 彈回去的速度：每 16.7ms 剩下多少 */
const SPRING = 0.8;

/** 手指拉 pull px 時頁面移多少：越拉越重，不會超過 MAX */
const rubber = (pull: number) => MAX * (1 - 1 / ((pull * TOUCH_PULL) / MAX + 1));

export function initOverscroll() {
  const page = document.querySelector<HTMLElement>(".page");
  if (!page) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;

  let offset = 0;
  let shown = 0;
  let lastInput = 0;
  let touching = false;
  let raf = 0;
  let last = 0;

  const edge = () => {
    const max = root.scrollHeight - window.innerHeight;
    return { top: window.scrollY <= 0, bottom: window.scrollY >= max - 1 };
  };

  const show = () => {
    const px = Math.round(offset * 2) / 2;
    if (px === shown) return;
    shown = px;
    page.style.top = px ? `${px}px` : "";
    window.dispatchEvent(new Event("page:shift"));
  };

  const frame = (time: number) => {
    raf = 0;
    const dt = last ? Math.min(time - last, 50) : 16.7;
    last = time;
    if (!touching && performance.now() - lastInput > HOLD) {
      offset *= Math.pow(SPRING, dt / 16.7);
      if (Math.abs(offset) < 0.5) offset = 0;
    }
    show();
    if (offset || touching) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  window.addEventListener(
    "wheel",
    (e) => {
      // ctrl + 滾輪是縮放，不是捲動
      if (reduce.matches || e.ctrlKey) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (!delta) return;
      const { top, bottom } = edge();
      const out = (top && delta < 0) || (bottom && delta > 0);
      if (out) {
        // 越拉越重
        const room = Math.max(1 - Math.abs(offset) / MAX, 0);
        offset -= delta * WHEEL_PULL * room * room;
      } else if (offset) {
        // 往回捲：先把拉出去的收回來，不要越過去
        const next = offset - delta;
        offset = Math.sign(next) === Math.sign(offset) ? next : 0;
      } else return;
      lastInput = performance.now();
      kick();
    },
    { passive: true },
  );

  // 手指：碰到頭尾那一刻開始算拉了多遠
  let anchor: number | null = null;
  window.addEventListener(
    "touchstart",
    (e) => {
      if (reduce.matches || e.touches.length > 1) return;
      touching = true;
      anchor = null;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (!touching || e.touches.length > 1) return;
      const y = e.touches[0].clientY;
      const { top, bottom } = edge();
      if (anchor === null) {
        if (top || bottom) anchor = y;
        return;
      }
      const pull = y - anchor;
      if (top && pull > 0) offset = rubber(pull);
      else if (bottom && pull < 0) offset = -rubber(-pull);
      else {
        offset = 0;
        anchor = top || bottom ? y : null;
      }
      kick();
    },
    { passive: true },
  );
  const release = () => {
    if (!touching) return;
    touching = false;
    kick();
  };
  window.addEventListener("touchend", release, { passive: true });
  window.addEventListener("touchcancel", release, { passive: true });
}
