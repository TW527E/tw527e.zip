// Liquid glass 的邊緣折射：卡片邊緣附近的背景會被往內「推」，像透過厚玻璃的圓角邊緣在看背景。
//
// 位移貼圖用 public/glass/ 裡事先做好的碎片（四個圓角 + 四條邊，scripts/make-glass-maps.mjs 產生），
// 依每張卡片的實際尺寸拼起來；折射帶固定幾個 px，卡片再長也不會被拉變形。
// 瀏覽器只肯讓濾鏡讀同網域的圖片檔，data: / blob: 都不行，所以不能在前端即時畫。
//
// 兩種做法：
// - Chromium：backdrop-filter 直接引用 SVG 濾鏡。
// - Safari、Firefox：backdrop-filter 不支援 SVG 濾鏡，改在卡片裡放一份對齊畫面的背景副本。
//   副本畫在 <svg> 裡、濾鏡也套在 SVG 元素上：Safari 把 SVG 濾鏡套在 HTML 元素上時，
//   座標是從頁面左上角算、feImage 的圖片也不會畫出來，套在 SVG 元素上就正常。
//   副本比卡片大一圈，模糊的邊緣落在裁掉的地方。

import { glSupported, initGlass } from "./liquid-gl";
import { isLite } from "./perf";

const SVG_NS = "http://www.w3.org/2000/svg";
const RES = Number(new URLSearchParams(location.search).get("res") ?? 1);
/** 碎片的圓角種類，要跟 scripts/make-glass-maps.mjs 一致 */
const RADII = [28, 32];
/** 折射帶寬度（px），要跟 scripts/make-glass-maps.mjs 一致 */
const BAND = 48;
/** 邊緣最大位移（px） */
const STRENGTH = 64;
/** 邊緣有多清楚：越大，清透的範圍越寬（從最外圈往內，位移量 × 這個數 = 清透的程度） */
const EDGE_CLEAR = 2;
/** 色散：藍色比紅色多彎幾成 */
const CHROMA = 0.3;
/** 只留下紅、綠、藍其中一個通道（透明度不變），三個加起來就是完整的顏色 */
const CHANNELS = [
  "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
];
/** 背景副本比卡片多出來的範圍（px），要比模糊半徑大 */
const MIRROR_MARGIN = 40;
/** 換成輕量模式時，折射淡出要多久（ms），要跟 global.css 的 .lite 一致 */
const LITE_FADE = 600;

type Mode = "backdrop" | "mirror";

interface Mirror {
  svg: SVGSVGElement;
  /** 套濾鏡的那層 */
  layer: SVGGElement;
  /** 跟著畫面對齊的那層 */
  view: SVGGElement;
  page: SVGRectElement;
  img: SVGImageElement;
  scrim: SVGRectElement;
}

interface Entry {
  filter?: SVGFilterElement;
  key: string;
  mirror?: Mirror;
}

const entries = new WeakMap<HTMLElement, Entry>();
let defs: SVGSVGElement | null = null;
let seq = 0;

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => b.brand === "Chromium");
}

function ensureDefs(): SVGSVGElement {
  if (defs) return defs;
  defs = document.createElementNS(SVG_NS, "svg");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.setAttribute("aria-hidden", "true");
  defs.setAttribute("focusable", "false");
  defs.classList.add("refract-defs");
  document.body.append(defs);
  return defs;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * 把碎片拼成一個位移濾鏡。
 * 套濾鏡的範圍比卡片大 inset px，卡片本身在裡面。
 * Chromium 的 backdrop-filter 只認比例座標（objectBoundingBox），SVG 元素上用 px。
 */
function buildFilter(w: number, h: number, inset: number, radius: number, units: "box" | "px", blur: number) {
  const r = RADII.reduce((a, b) => (Math.abs(b - radius) < Math.abs(a - radius) ? b : a));
  const c = Math.max(r, BAND);
  const boxW = w + inset * 2;
  const boxH = h + inset * 2;
  const sx = units === "box" ? 1 / boxW : 1;
  const sy = units === "box" ? 1 / boxH : 1;
  const pieces: [string, number, number, number, number][] = [
    ["tl", 0, 0, c, c],
    ["tr", w - c, 0, c, c],
    ["bl", 0, h - c, c, c],
    ["br", w - c, h - c, c, c],
    ["t", c, 0, w - 2 * c, c],
    ["b", c, h - c, w - 2 * c, c],
    ["l", 0, c, c, h - 2 * c],
    ["r", w - c, c, c, h - 2 * c],
  ];

  const filter = el("filter", { id: `refract-${++seq}`, "color-interpolation-filters": "sRGB" });
  if (units === "box") {
    for (const [k, v] of Object.entries({ x: 0, y: 0, width: "100%", height: "100%", primitiveUnits: "objectBoundingBox" })) {
      filter.setAttribute(k, String(v));
    }
  } else {
    for (const [k, v] of Object.entries({ filterUnits: "userSpaceOnUse", x: 0, y: 0, width: boxW, height: boxH })) {
      filter.setAttribute(k, String(v));
    }
  }
  filter.append(
    el("feFlood", { "flood-color": "rgb(128,128,128)", result: "base", x: 0, y: 0, width: boxW * sx, height: boxH * sy }),
  );
  const merge = el("feMerge", { result: "map" });
  merge.append(el("feMergeNode", { in: "base" }));
  for (const [name, x, y, pw, ph] of pieces) {
    filter.append(
      el("feImage", {
        href: `/${new URLSearchParams(location.search).get("tiles") === "old" ? "glass-old" : "glass"}/r${r}-${name}.png`,
        x: (x + inset) * sx,
        y: (y + inset) * sy,
        width: pw * sx,
        height: ph * sy,
        preserveAspectRatio: "none",
        result: name,
      }),
    );
    merge.append(el("feMergeNode", { in: name }));
  }
  filter.append(merge);

  const q = new URLSearchParams(location.search);
  const strength = Number(q.get("strength") ?? STRENGTH);
  const scale = units === "box" ? (strength * 2) / boxW : strength * 2;
  let source = "SourceGraphic";
  if (units === "px" && blur > 0) {
    filter.append(el("feGaussianBlur", { in: source, stdDeviation: blur, edgeMode: "duplicate", result: "frosted" }));
    source = "frosted";
  }
  const chroma = Number(q.get("chroma") ?? 0);
  const add = (a: string, b: string, result: string) =>
    el("feComposite", { in: a, in2: b, operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0, result });
  if (chroma && q.get("strips") === "1") {
    // 單色折射整張，色散只在四條邊上算，再疊上去
    filter.append(el("feDisplacementMap", { in: source, in2: "map", scale, xChannelSelector: "R", yChannelSelector: "G", result: "refracted0" }));
    const strips: [number, number, number, number][] = [
      [0, 0, w, BAND], [0, h - BAND, w, BAND], [0, BAND, BAND, h - 2 * BAND], [w - BAND, BAND, BAND, h - 2 * BAND],
    ];
    const merge2 = el("feMerge", { result: "refracted" });
    merge2.append(el("feMergeNode", { in: "refracted0" }));
    strips.forEach(([x, y, sw, sh], n) => {
      const area = { x: (x + inset) * sx, y: (y + inset) * sy, width: sw * sx, height: sh * sy };
      CHANNELS.forEach((values, i) => {
        filter.append(
          el("feDisplacementMap", { in: source, in2: "map", scale: scale * (1 + (chroma * i) / 2), xChannelSelector: "R", yChannelSelector: "G", ...area }),
          el("feColorMatrix", { type: "matrix", values, result: `s${n}c${i}`, ...area }),
        );
      });
      const a2 = (a: string, b: string, result: string) => el("feComposite", { in: a, in2: b, operator: "arithmetic", k1: 0, k2: 1, k3: 1, k4: 0, result, ...area });
      filter.append(a2(`s${n}c0`, `s${n}c1`, `s${n}rg`), a2(`s${n}rg`, `s${n}c2`, `s${n}`));
      merge2.append(el("feMergeNode", { in: `s${n}` }));
    });
    filter.append(merge2);
  } else if (!chroma) {
    filter.append(el("feDisplacementMap", { in: source, in2: "map", scale, xChannelSelector: "R", yChannelSelector: "G", result: "refracted" }));
  } else {
    CHANNELS.forEach((values, i) => {
      filter.append(
        el("feDisplacementMap", { in: source, in2: "map", scale: scale * (1 + (chroma * i) / 2), xChannelSelector: "R", yChannelSelector: "G" }),
        el("feColorMatrix", { type: "matrix", values, result: `ch${i}` }),
      );
    });
    filter.append(add("ch0", "ch1", "rg"), add("rg", "ch2", "refracted"));
  }
  if (q.get("spec") === "1") {
    filter.append(
      el("feColorMatrix", { in: "map", type: "matrix", values: `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 2 0 ${-256 / 255}`, result: "rim" }),
      add("rim", "refracted", "lit"),
    );
  }
  return filter;
}

function createMirror(card: HTMLElement): Mirror {
  const box = document.createElement("div");
  box.className = "refract-mirror";
  box.setAttribute("aria-hidden", "true");
  const svg = el("svg", { focusable: "false" });
  svg.classList.add("refract-mirror__box");
  const layer = el("g", {});
  const view = el("g", {});
  const scaler = el("g", { transform: `scale(${RES})` });
  const page = el("rect", { x: 0, y: 0 });
  page.classList.add("refract-mirror__page");
  const img = el("image", { preserveAspectRatio: "xMidYMid slice" });
  img.classList.add("refract-mirror__img");
  const scrim = el("rect", { x: 0, y: 0 });
  scrim.classList.add("refract-mirror__scrim");
  view.append(page, img, scrim);
  layer.append(view);
  scaler.append(layer);
  svg.append(scaler);
  svg.style.transform = `scale(${1 / RES})`;
  svg.style.transformOrigin = "0 0";
  box.append(svg);
  card.prepend(box);
  return { svg, layer, view, page, img, scrim };
}

/** 背景副本跟真正的背景用同一張圖，漂移動畫也對齊 */
function syncImage(mirror: Mirror) {
  const bg = document.getElementById("bg-img") as HTMLImageElement | null;
  const src = bg?.currentSrc || bg?.src;
  if (!bg || !src) return;
  const syncTime = () => {
    const source = bg.getAnimations().find((a) => a instanceof CSSAnimation);
    const copy = mirror.img.getAnimations().find((a) => a instanceof CSSAnimation);
    if (source && copy) copy.currentTime = source.currentTime;
  };
  mirror.img.classList.toggle("is-loaded", bg.classList.contains("is-loaded"));
  if (mirror.img.getAttribute("href") !== src) {
    // Safari 換圖時會讓動畫重新開始，所以等圖載好再對一次
    mirror.img.addEventListener("load", syncTime, { once: true });
    mirror.img.setAttribute("href", src);
  }
  syncTime();
}

function placeMirror(card: HTMLElement, mirror: Mirror) {
  const rect = card.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const node of [mirror.page, mirror.scrim]) {
    node.setAttribute("width", String(vw));
    node.setAttribute("height", String(vh));
  }
  // 跟 .bg__img 一樣：比畫面大 8%、置中裁切
  mirror.img.setAttribute("x", String(vw * -0.04));
  mirror.img.setAttribute("y", String(vh * -0.04));
  mirror.img.setAttribute("width", String(vw * 1.08));
  mirror.img.setAttribute("height", String(vh * 1.08));
  mirror.view.setAttribute("transform", `translate(${MIRROR_MARGIN - rect.left} ${MIRROR_MARGIN - rect.top})`);
}

function update(card: HTMLElement, mode: Mode) {
  const w = Math.round(card.offsetWidth);
  const h = Math.round(card.offsetHeight);
  if (w < 80 || h < 80) return;
  const style = getComputedStyle(card);
  const radius = parseFloat(style.borderTopLeftRadius) || 0;
  // 模糊在濾鏡裡做，中間霧面、邊緣清透
  const blur = parseFloat(style.getPropertyValue("--blur")) || 0;
  let entry = entries.get(card);
  const fresh = !entry;
  if (!entry) {
    entry = { key: "" };
    if (mode === "mirror") entry.mirror = createMirror(card);
    entries.set(card, entry);
  }
  const key = `${w}x${h}r${radius}b${blur}`;
  if (entry.key !== key) {
    entry.key = key;
    // 每次換一個新的濾鏡：Safari 不會因為濾鏡內容改了就重畫，換掉引用才會
    const inset = mode === "mirror" ? MIRROR_MARGIN : 0;
    const filter = buildFilter(w, h, inset, radius, mode === "mirror" ? "px" : "box", blur);
    ensureDefs().append(filter);
    if (entry.mirror) {
      entry.mirror.svg.setAttribute("width", String((w + inset * 2) * RES));
      entry.mirror.svg.setAttribute("height", String((h + inset * 2) * RES));
      entry.mirror.layer.setAttribute("filter", `url(#${filter.id})`);
    } else {
      card.style.setProperty("--refract", `url(#${filter.id})`);
      const order = new URLSearchParams(location.search).get("order");
      card.style.backdropFilter = order === "blurfirst" ? `blur(${blur}px) url(#${filter.id}) saturate(180%)` : `url(#${filter.id}) blur(${blur}px) saturate(180%)`;
    }
    entry.filter?.remove();
    entry.filter = filter;
  }
  if (entry.mirror) placeMirror(card, entry.mirror);
  card.dataset.refractReady = "";
  // 副本要顯示出來之後才有漂移動畫可以對時間
  if (fresh && entry.mirror) syncImage(entry.mirror);
}

function clear(card: HTMLElement) {
  delete card.dataset.refractReady;
}

export function initLiquid() {
  if (new URLSearchParams(location.search).has("gl") && glSupported()) return initLiquidGl();
  const mode: Mode = isChromium() && new URLSearchParams(location.search).get("mode") !== "mirror" ? "backdrop" : "mirror";
  document.documentElement.classList.add("liquid", `liquid--${mode}`);

  // 窄螢幕（手機）或要求減少透明度時不做折射（省電、也比較好讀）。
  // 不看 (hover: hover)：有些 Linux 桌機會因為虛擬指標裝置被誤判成沒有滑鼠。
  // 減少透明度要分開查：Safari 不認得這個查詢，寫成 "no-preference" 會永遠不成立。
  const wide = window.matchMedia("(min-width: 960px)");
  const reduce = window.matchMedia("(prefers-reduced-transparency: reduce)");
  const wanted = { get matches() { return wide.matches && !reduce.matches && !isLite(); } };
  const targets = [...document.querySelectorAll<HTMLElement>("[data-refract]")];
  if (targets.length === 0) return;

  let pending = new Set<HTMLElement>();
  let raf = 0;
  const flush = () => {
    raf = 0;
    for (const card of pending) update(card, mode);
    pending = new Set();
  };
  const schedule = (cards: Iterable<HTMLElement>) => {
    if (!wanted.matches) return;
    for (const card of cards) pending.add(card);
    if (!raf) raf = requestAnimationFrame(flush);
  };
  // 尺寸變了就直接更新：ResizeObserver 本來就在排版之後、繪製之前呼叫，不用再等下一幀
  const observer = new ResizeObserver((records) => {
    if (!wanted.matches) return;
    for (const r of records) update(r.target as HTMLElement, mode);
  });

  if (mode === "mirror") {
    // 卡片會跟著頁面捲動、背景不會，所以捲動時要重新對齊副本。
    // 跑不動的裝置會換成輕量模式（scripts/perf.ts），不做折射，也就不用對齊了。
    window.addEventListener("scroll", () => schedule(targets), { passive: true });
    window.addEventListener("resize", () => schedule(targets), { passive: true });
    // 進場動畫會移動卡片，結束後再對齊一次
    targets.forEach((card) => card.addEventListener("animationend", () => schedule([card])));
    document.addEventListener("bg:change", () => {
      for (const card of targets) {
        const mirror = entries.get(card)?.mirror;
        if (mirror) syncImage(mirror);
      }
    });
  }

  const apply = () => {
    if (wanted.matches) {
      targets.forEach((card) => observer.observe(card));
    } else {
      observer.disconnect();
      targets.forEach(clear);
    }
  };
  wide.addEventListener("change", apply);
  reduce.addEventListener("change", apply);
  // 換成輕量模式：等折射淡出之後再拆掉
  document.addEventListener("perf:lite", () => setTimeout(apply, LITE_FADE));
  // 在頁尾關掉輕量模式：馬上換回來
  document.addEventListener("perf:full", apply);
  apply();
}

/** 實驗：WebGL 版（scripts/liquid-gl.ts） */
function initLiquidGl() {
  document.documentElement.classList.add("liquid", "liquid--gl");
  // WebGL 版很省，手機也開
  const reduce = window.matchMedia("(prefers-reduced-transparency: reduce)");
  const wanted = { get matches() { return !reduce.matches && !isLite(); } };
  const targets = [...document.querySelectorAll<HTMLElement>("[data-refract]")];
  const apply = initGlass(targets, wanted);
  if (!apply) return;
  reduce.addEventListener("change", apply);
  document.addEventListener("perf:lite", () => setTimeout(apply, LITE_FADE));
  // 在頁尾關掉輕量模式：馬上換回來
  document.addEventListener("perf:full", apply);
  apply();
}
