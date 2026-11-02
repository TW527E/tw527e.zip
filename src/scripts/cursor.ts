// 仿 iPadOS 的游標：平常是跟著滑鼠的小圓點，移到按鈕、卡片、標籤上會吸附並變成那個東西的形狀，
// 還會微微跟著滑鼠偏移；移到一般文字上會變成跟那一行一樣高的直線（文字游標）。
// 不能點的東西想要吸附，加上 data-cursor 就好。
// 只在有滑鼠、沒要求減少動態效果時啟用；不會隱藏系統游標，只是額外疊一層。
const INTERACTIVE = "a, button, [role='button'], summary, label, [data-cursor]";
/** 打字用的輸入框：裡面的字拿不到位置，直接用文字游標 */
const TEXT_FIELD = "input:is([type='text'], [type='search'], [type='email'], [type='url'], :not([type])):not(:disabled), textarea:not(:disabled)";
/** 比這個高的算「大卡片」：光圈貼著卡片、顏色更淡，偏移也比較少 */
const WIDE_H = 72;
/** 吸附時比目標大多少（px） */
const PAD = 5;
const PAD_WIDE = 3;
/** 吸附時跟著滑鼠偏移的比例，和最多偏移幾 px */
const PARALLAX = 0.2;
const MAX_SHIFT = 8;
const DOT = 22;
/** 文字游標的寬度（px） */
const BEAM = 3;
/** 每一幀往目標靠近的比例，越大越快 */
const EASE = 0.28;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** 按下時縮小一點 */
  s: number;
}

export function initCursor() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || reduce.matches) return;

  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  ring.setAttribute("aria-hidden", "true");
  document.body.append(ring);

  let px = -100;
  let py = -100;
  let target: HTMLElement | null = null;
  let radius = 0;
  let pad = PAD;
  /** 滑鼠在文字上時，那一行的垂直中心和高度 */
  let beam: { y: number; h: number } | null = null;
  let down = false;
  const cur: Box = { x: px, y: py, w: DOT, h: DOT, r: DOT / 2, s: 1 };
  let raf = 0;

  /** 現在游標應該長什麼樣子 */
  const goal = (): Box => {
    const s = down ? 0.94 : 1;
    if (!target && beam) return { x: px, y: beam.y, w: BEAM, h: beam.h, r: BEAM / 2, s };
    if (!target) return { x: px, y: py, w: DOT, h: DOT, r: DOT / 2, s };
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const w = rect.width + pad * 2;
    const h = rect.height + pad * 2;
    const shift = (d: number) => Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, d * PARALLAX));
    return {
      x: cx + shift(px - cx),
      y: cy + shift(py - cy),
      w,
      h,
      r: Math.min(radius + pad, h / 2, w / 2),
      s,
    };
  };

  /** 停下來之後畫過最後一次了沒 */
  let drawn = false;
  const tick = () => {
    const g = goal();
    let moving = false;
    for (const k of ["x", "y", "w", "h", "r", "s"] as const) {
      const d = g[k] - cur[k];
      if (Math.abs(d) > (k === "s" ? 0.001 : 0.1)) {
        cur[k] += d * EASE;
        moving = true;
      } else {
        cur[k] = g[k];
      }
    }
    // 吸附時每一幀都會跑到這裡，但大部分時候沒變；沒變就不要寫，不然每一幀都要重畫
    if (moving || !drawn) {
      // 停下來的那一幀還要再畫一次：上面把最後一點距離直接補到位了
      drawn = !moving;
      ring.style.width = `${cur.w}px`;
      ring.style.height = `${cur.h}px`;
      ring.style.borderRadius = `${cur.r}px`;
      // 縮放要放在位移後面，才會以游標自己為中心縮小，不會被拉往畫面左上角
      ring.style.transform = `translate3d(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px, 0) scale(${cur.s})`;
    }
    // 吸附中的按鈕本身也可能在動（hover 彈跳），所以吸附時持續更新
    raf = moving || target ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };

  /** 滑鼠底下如果是文字，回傳那一行的位置 */
  const textLine = (x: number, y: number) => {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const node = doc.caretPositionFromPoint?.(x, y)?.offsetNode ?? doc.caretRangeFromPoint?.(x, y)?.startContainer;
    if (!(node instanceof Text) || !node.data.trim()) return null;
    // 上面的函式會回傳「最近的」文字，要確認滑鼠真的在字上
    const range = document.createRange();
    range.selectNodeContents(node);
    // 字的框比行高矮，行與行中間的空隙也算在那一行裡，游標才不會在行間跳回圓點
    const lineHeight = parseFloat(getComputedStyle(node.parentElement ?? document.body).lineHeight);
    for (const rect of range.getClientRects()) {
      const gap = Number.isNaN(lineHeight) ? 2 : Math.max((lineHeight - rect.height) / 2, 0) + 1;
      if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - gap && y <= rect.bottom + gap) {
        return { y: rect.top + rect.height / 2, h: rect.height };
      }
    }
    return null;
  };

  /** 滑鼠在輸入框上時，游標高度跟框裡的字一樣，放在框的正中間 */
  const fieldLine = (el: Element | null) => {
    const field = el?.closest<HTMLElement>(TEXT_FIELD);
    if (!field) return null;
    const rect = field.getBoundingClientRect();
    const h = parseFloat(getComputedStyle(field).fontSize) * 1.25;
    return { y: field instanceof HTMLTextAreaElement ? py : rect.top + rect.height / 2, h };
  };

  let hovered: HTMLElement | null = null;
  /** 每個東西的圓角查一次就記住：吸附那一瞬間少做一點事 */
  const radii = new WeakMap<HTMLElement, number>();
  const pick = (el: Element | null) => {
    const hit = el?.closest<HTMLElement>(INTERACTIVE) ?? null;
    // 沒吸附在東西上時，每次移動都要看看底下是不是文字
    beam = hit ? null : (fieldLine(el) ?? textLine(px, py));
    ring.classList.toggle("is-text", !!beam);
    if (hit === hovered) return;
    hovered = hit;
    target = null;
    ring.classList.remove("is-snapped", "is-wide");
    if (!hit) return;
    const rect = hit.getBoundingClientRect();
    // 只看高度：伺服器位址框、Discord 按鈕這種又寬又矮的，還是用一般的吸附
    const wide = rect.height > WIDE_H;
    target = hit;
    pad = wide ? PAD_WIDE : PAD;
    // 文字連結沒有圓角，給一點圓角比較像 iPad
    let r = radii.get(hit);
    if (r === undefined) {
      r = Math.max(parseFloat(getComputedStyle(hit).borderTopLeftRadius) || 0, 8);
      radii.set(hit, r);
    }
    radius = r;
    ring.classList.add("is-snapped");
    ring.classList.toggle("is-wide", wide);
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      if (!ring.classList.contains("is-visible")) {
        // 第一次出現時直接放在滑鼠位置，不要從角落飛進來
        cur.x = e.clientX;
        cur.y = e.clientY;
        ring.classList.add("is-visible");
      }
      px = e.clientX;
      py = e.clientY;
      pick(e.target instanceof Element ? e.target : null);
      kick();
    },
    { passive: true },
  );
  // 捲動事件一幀可能來好幾次，找滑鼠底下是什麼一幀做一次就好
  let scrollPick = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollPick) return;
      scrollPick = requestAnimationFrame(() => {
        scrollPick = 0;
        pick(document.elementFromPoint(px, py));
        kick();
      });
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => ring.classList.remove("is-visible"));
  const press = (on: boolean) => {
    down = on;
    kick();
  };
  window.addEventListener("pointerdown", () => press(true), { passive: true });
  window.addEventListener("pointerup", () => press(false), { passive: true });
}
