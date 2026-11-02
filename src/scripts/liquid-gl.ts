// 實驗：用 WebGL 畫玻璃的折射（網址加 ?gl 才會用）。
//
// 玻璃後面只有一張背景圖，所以不用截網頁：直接把背景圖交給 GPU。每張卡片分成兩層：
// - 霧面：一張事先模糊好的背景圖，固定在畫面上（position: fixed），用 clip-path 裁成卡片的形狀。
//   捲動、背景漂移都是瀏覽器自己對齊，不用重畫，也不會慢一幀。
// - 邊緣：卡片裡的 WebGL 畫布，只畫邊緣那一圈的折射、色散和高光，中間是透明的。
//   卡片移動時要重畫，只有這一圈會慢一幀。
// 卡片上沒有 backdrop-filter，字、高光、游標重畫時，不用跟著重算玻璃。
// 背景的漂移、淡入、深淺色的遮罩都從 .bg 讀，跟真正的背景對齊。

const q = new URLSearchParams(location.search);
const num = (key: string, fallback: number) => (q.has(key) ? Number(q.get(key)) : fallback);

/** 折射帶寬度（px），跟 make-glass-maps.mjs 一樣 */
const BAND = num("band", 48);
/** 邊緣最大位移（px） */
const STRENGTH = num("strength", 64);
/** 色散：藍色比紅色多彎幾成 */
const CHROMA = num("chroma", 0.3);
/** 邊緣有多清透：0 = 整張一樣霧，1 = 最外圈完全清楚 */
const EDGE = num("edge", 0.7);
/** 邊緣高光強度（0–1）、寬度（px）、光源方向（度），跟 make-glass-maps.mjs 一樣 */
const SPECULAR = num("spec", 0.7);
const SPECULAR_WIDTH = 1.5;
const LIGHT_ANGLE = -120;
const CURVATURE = 3;
const IOR = 1.5;
/** 跟 CSS 的 saturate(180%) 一樣 */
const SATURATE = 1.8;
/** 畫布最多用幾倍解析度 */
const MAX_DPR = 2;
/** 手機停止捲動多久之後，邊緣那層淡回來（ms） */
const SCROLL_IDLE = 140;
/** 觸控板拉過頁面頭尾之後，等多久（彈回去）邊緣那層才淡回來（ms） */
const OVERSCROLL_IDLE = 700;

type RGBA = [number, number, number, number];

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** 邊緣那一圈。顏色都已經加過飽和度（模糊圖烘進去了、底色和遮罩在 JS 算好），中間透明 */
const RIM = `
precision highp float;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uCanvas;   // 畫布像素
uniform float uDpr;
uniform vec2 uSize;     // 卡片大小（CSS px）
uniform float uRadius;
uniform vec2 uOrigin;   // 卡片左上角在畫面上的位置
uniform vec3 uU;        // 畫面座標 → 背景圖座標
uniform vec3 uV;
uniform vec3 uPage;     // 圖片還沒出來時的底色
uniform vec4 uScrim;    // 背景上的遮罩（a 已乘上透明度）
uniform float uImgAlpha;
uniform float uOpaque;  // 1 = 中間也畫（霧面那層還沒對齊的時候）
uniform float uBand;
uniform float uStrength;
uniform float uChroma;
uniform float uEdge;
uniform float uSpec;
uniform vec2 uLight;

const float K = ${CURVATURE.toFixed(1)};
const float IOR = ${IOR.toFixed(3)};
const float SAT = ${SATURATE.toFixed(2)};

vec2 toUv(vec2 p) { vec3 h = vec3(p, 1.0); return vec2(dot(uU, h), dot(uV, h)); }

vec3 saturate(vec3 c) {
  float lum = dot(c, vec3(0.213, 0.715, 0.072));
  return lum + (c - lum) * SAT;
}

// 邊緣往內 t（0 = 最外圈、1 = 折射帶內側）的位置光線偏多少，最外圈 = 1
float bend(float t) {
  t = clamp(t, 0.0, 0.9999);
  float a = pow(1.0 - t, K);
  float slope = pow(1.0 - t, K - 1.0) * pow(max(1.0 - a, 1e-6), 1.0 / K - 1.0);
  float theta = atan(slope);
  float b = tan(theta - asin(sin(theta) / IOR));
  float top = tan(1.5707963 - asin(1.0 / IOR));
  return clamp(b / top, 0.0, 1.0);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) / uDpr;
  vec2 c = p - uSize * 0.5;
  vec2 q = abs(c) - (uSize * 0.5 - uRadius);
  vec2 o = max(q, 0.0);
  float outside = length(o);
  float depth = -(outside + min(max(q.x, q.y), 0.0) - uRadius);
  // 折射帶裡面霧面那層會畫，這裡不用畫
  float alpha = max(uOpaque, 1.0 - smoothstep(uBand - 6.0, uBand, depth));
  if (alpha <= 0.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec2 n = outside > 0.0 ? o / outside : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  n *= vec2(c.x < 0.0 ? -1.0 : 1.0, c.y < 0.0 ? -1.0 : 1.0);

  float k = depth < uBand ? bend(depth / uBand) : 0.0;
  vec2 at = uOrigin + p;
  vec2 shift = n * k * uStrength;
  // 越靠邊越清楚
  float frost = mix(1.0 - uEdge, 1.0, smoothstep(0.0, uBand, depth));
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec2 uv = toUv(at - shift * (1.0 + uChroma * float(i) * 0.5));
    vec3 s = mix(saturate(texture2D(uSharp, uv).rgb), texture2D(uBlur, uv).rgb, frost);
    if (i == 0) col.r = s.r; else if (i == 1) col.g = s.g; else col.b = s.b;
  }
  col = mix(uPage, col, uImgAlpha);
  col = mix(col, uScrim.rgb, uScrim.a);

  float d = max(depth, 0.0);
  float crisp = max(0.0, 1.0 - d / ${SPECULAR_WIDTH.toFixed(2)});
  float glow = max(0.0, 1.0 - d / ${(SPECULAR_WIDTH * 5).toFixed(2)});
  float rim = uSpec * (crisp * crisp + 0.3 * glow * glow);
  float facing = dot(n, uLight);
  float shade = 0.12 + 0.88 * (facing > 0.0 ? facing : -0.4 * facing);
  col += min(1.0, rim * shade);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;

/** 高斯模糊（分兩次：橫、直），第二次順便加飽和度 */
const GAUSS = `
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSize;
uniform vec2 uDir;
uniform float uSigma;
uniform float uSat;
uniform float uFlip;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -24; i <= 24; i++) {
    float x = float(i);
    if (abs(x) > uSigma * 3.0) continue;
    float w = exp(-x * x / (2.0 * uSigma * uSigma));
    sum += texture2D(uSrc, uv + uDir * x / uSize) * w;
    total += w;
  }
  vec3 c = sum.rgb / total;
  float lum = dot(c, vec3(0.213, 0.715, 0.072));
  gl_FragColor = vec4(lum + (c - lum) * uSat, 1.0);
}
`;

/** 背景圖準備好的樣子（每換一張圖做一次，所有卡片共用） */
interface Source {
  key: string;
  sharp: HTMLCanvasElement;
  /** 依模糊半徑分開做：模糊好、加過飽和度的圖。霧面那層用 url，邊緣那層用 canvas */
  frost: Map<number, { canvas: HTMLCanvasElement; url: string }>;
}

/** 從畫面座標換到背景圖座標要用的資料（每一幀讀一次） */
interface Scene {
  key: string;
  u: [number, number, number];
  v: [number, number, number];
  /** 都已經加過飽和度 */
  page: RGBA;
  scrim: RGBA;
  imgAlpha: number;
  imgLoaded: boolean;
  source: Source | null;
}

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const colors = new Map<string, RGBA>();
/** 任何 CSS 顏色 → 0–1 的 RGBA */
function parseColor(css: string): RGBA {
  let hit = colors.get(css);
  if (hit) return hit;
  hit = [0, 0, 0, 0];
  if (probe) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    hit = [r / 255, g / 255, b / 255, a / 255];
  }
  colors.set(css, hit);
  return hit;
}

function saturate([r, g, b, a]: RGBA): RGBA {
  const lum = 0.213 * r + 0.715 * g + 0.072 * b;
  const s = (x: number) => Math.min(1, Math.max(0, lum + (x - lum) * SATURATE));
  return [s(r), s(g), s(b), a];
}

const css = ([r, g, b, a]: RGBA) => `rgb(${r * 255} ${g * 255} ${b * 255} / ${a})`;

function compile(gl: WebGLRenderingContext, frag: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, frag],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  return program;
}

/** 一個蓋滿畫面的三角形 */
function fullscreen(gl: WebGLRenderingContext) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

function texture(gl: WebGLRenderingContext, src: TexImageSource | null, w = 0, h = 0) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

/** 把縮小過的背景圖模糊、加飽和度，畫到一般的 canvas 上（用一個臨時的 WebGL，做完就丟掉） */
function bake(small: HTMLCanvasElement, sigma: number): HTMLCanvasElement | null {
  const w = small.width;
  const h = small.height;
  const glCanvas = document.createElement("canvas");
  glCanvas.width = w;
  glCanvas.height = h;
  const gl = glCanvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) return null;
  const program = compile(gl, GAUSS);
  fullscreen(gl);
  gl.useProgram(program);
  const u = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(u("uSrc"), 0);
  gl.uniform2f(u("uSize"), w, h);
  gl.uniform1f(u("uSigma"), sigma);
  gl.viewport(0, 0, w, h);
  const input = texture(gl, small);
  const tmp = texture(gl, null, w, h);
  const fbo = gl.createFramebuffer();
  // 橫的：畫到暫存的貼圖
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tmp, 0);
  gl.bindTexture(gl.TEXTURE_2D, input);
  gl.uniform2f(u("uDir"), 1, 0);
  gl.uniform1f(u("uSat"), 1);
  gl.uniform1f(u("uFlip"), 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // 直的：畫到畫布上，順便加飽和度。WebGL 是下往上，畫的時候上下翻過來
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, tmp);
  gl.uniform2f(u("uDir"), 0, 1);
  gl.uniform1f(u("uSat"), SATURATE);
  gl.uniform1f(u("uFlip"), 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  // 同一個工作裡複製，WebGL 的畫面還在
  out.getContext("2d")!.drawImage(glCanvas, 0, 0);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return out;
}

/** 有沒有哪一層祖先會讓 position: fixed 不是對著畫面（transform、filter 之類） */
function fixedBroken(el: HTMLElement | null) {
  for (; el && el !== document.body; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.transform !== "none" || s.filter !== "none" || s.perspective !== "none") return true;
    if ((s.backdropFilter || s.getPropertyValue("-webkit-backdrop-filter") || "none") !== "none") return true;
    if (s.willChange.includes("transform") || s.willChange.includes("filter")) return true;
    if (/paint|layout|strict|content/.test(s.contain)) return true;
  }
  return false;
}

/** 一張卡片的兩層 */
class Pane {
  readonly box: HTMLDivElement;
  private frost: HTMLDivElement;
  private frostImg: HTMLImageElement;
  private frostScrim: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private rim: WebGLProgram;
  private loc = new Map<string, WebGLUniformLocation | null>();
  private sharp: WebGLTexture | null = null;
  private blur: WebGLTexture | null = null;
  private sourceKey = "";
  private drawn = "";
  private colorKey = "";
  /** 霧面那層還沒對齊，整張都用 WebGL 畫 */
  opaque = true;
  lost = false;

  constructor(
    readonly card: HTMLElement,
    gl: WebGLRenderingContext,
    canvas: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.rim = compile(gl, RIM);
    fullscreen(gl);
    this.box = document.createElement("div");
    this.box.className = "refract-mirror refract-mirror--gl";
    this.box.setAttribute("aria-hidden", "true");
    this.frost = document.createElement("div");
    this.frost.className = "refract-frost";
    this.frostImg = document.createElement("img");
    this.frostImg.className = "refract-frost__img";
    this.frostImg.alt = "";
    this.frostScrim = document.createElement("div");
    this.frostScrim.className = "refract-frost__scrim";
    this.frost.append(this.frostImg, this.frostScrim);
    canvas.className = "refract-mirror__gl";
    this.box.append(this.frost, canvas);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      delete card.dataset.refractReady;
    });
    card.prepend(this.box);
  }

  private u(name: string) {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.rim, name));
    return this.loc.get(name) ?? null;
  }

  /** 換了背景圖或模糊半徑：重新上傳 */
  private upload(source: Source, blurPx: number) {
    const key = `${source.key}|${blurPx}`;
    if (this.sourceKey === key) return;
    const frost = source.frost.get(blurPx);
    if (!frost) return;
    this.sourceKey = key;
    const gl = this.gl;
    if (this.sharp) gl.deleteTexture(this.sharp);
    if (this.blur) gl.deleteTexture(this.blur);
    this.sharp = texture(gl, source.sharp);
    this.blur = texture(gl, frost.canvas);
  }

  /** 霧面那張圖（blob 網址做好之後才有）載好了沒 */
  private frostReady(source: Source, blurPx: number) {
    const url = source.frost.get(blurPx)?.url;
    if (!url) return false;
    if (this.frostImg.getAttribute("src") !== url) {
      this.frostImg.addEventListener(
        "load",
        () => {
          syncDrift(this.frostImg);
          this.invalidate();
        },
        { once: true },
      );
      this.frostImg.src = url;
    }
    return this.frostImg.complete && this.frostImg.naturalWidth > 0;
  }

  /** 下一幀一定重畫 */
  invalidate() {
    this.drawn = "";
  }

  draw(scene: Scene, blurPx: number, radius: number) {
    if (this.lost) return;
    const rect = this.card.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const key = `${scene.key}|${rect.left},${rect.top},${rect.width},${rect.height}|${radius}|${blurPx}`;
    if (key === this.drawn) return;
    this.drawn = key;

    // 霧面那層：底色、遮罩、淡入跟真正的背景一樣
    const colorKey = `${scene.page.join()}|${scene.scrim.join()}|${scene.imgLoaded}|${radius}`;
    if (colorKey !== this.colorKey) {
      this.colorKey = colorKey;
      this.frost.style.backgroundColor = css(scene.page);
      this.frostScrim.style.backgroundColor = css(scene.scrim);
      this.frostImg.classList.toggle("is-loaded", scene.imgLoaded);
      this.box.style.clipPath = `inset(0 round ${radius}px)`;
    }
    if (scene.source) this.upload(scene.source, blurPx);
    this.card.dataset.refractReady = "";
    // 進場動畫（transform）的時候，fixed 會對著卡片而不是畫面，霧面那層會歪掉：先整張用 WebGL 畫
    const opaque = !scene.source || !this.frostReady(scene.source, blurPx) || fixedBroken(this.card);
    this.frost.style.visibility = opaque ? "hidden" : "";
    this.opaque = opaque;
    this.box.toggleAttribute("data-opaque", opaque);

    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const g = this.rim;
    gl.useProgram(g);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blur);
    gl.uniform1i(this.u("uSharp"), 0);
    gl.uniform1i(this.u("uBlur"), 1);
    gl.uniform2f(this.u("uCanvas"), w, h);
    gl.uniform1f(this.u("uDpr"), w / cw);
    // 形狀用排版的大小，位置用畫面上的位置（進場動畫有縮放）
    gl.uniform2f(this.u("uSize"), cw, ch);
    gl.uniform1f(this.u("uRadius"), radius);
    gl.uniform2f(this.u("uOrigin"), rect.left, rect.top);
    gl.uniform3f(this.u("uU"), ...scene.u);
    gl.uniform3f(this.u("uV"), ...scene.v);
    gl.uniform3f(this.u("uPage"), scene.page[0], scene.page[1], scene.page[2]);
    gl.uniform4f(this.u("uScrim"), ...scene.scrim);
    gl.uniform1f(this.u("uImgAlpha"), this.sharp ? scene.imgAlpha : 0);
    gl.uniform1f(this.u("uOpaque"), opaque ? 1 : 0);
    gl.uniform1f(this.u("uBand"), BAND);
    gl.uniform1f(this.u("uStrength"), STRENGTH);
    gl.uniform1f(this.u("uChroma"), CHROMA);
    gl.uniform1f(this.u("uEdge"), EDGE);
    gl.uniform1f(this.u("uSpec"), SPECULAR);
    const a = (LIGHT_ANGLE * Math.PI) / 180;
    gl.uniform2f(this.u("uLight"), Math.cos(a), Math.sin(a));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** 換背景圖之後，霧面的漂移動畫要對齊 */
  resync() {
    syncDrift(this.frostImg);
  }

  destroy() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.box.remove();
    delete this.card.dataset.refractReady;
  }
}

/** 霧面那張圖的漂移動畫跟真正的背景對齊 */
function syncDrift(img: HTMLImageElement) {
  const bg = document.getElementById("bg-img");
  const source = bg?.getAnimations().find((a) => a instanceof CSSAnimation);
  const copy = img.getAnimations().find((a) => a instanceof CSSAnimation);
  if (source && copy) copy.currentTime = source.currentTime;
}

function isChromium(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => b.brand === "Chromium");
}

/** 這台裝置能不能用 WebGL */
export function glSupported() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** 解析 CSS transform 的 matrix(a, b, c, d, e, f) */
function matrixOf(value: string): [number, number, number, number, number, number] {
  const m = value.match(/matrix\(([^)]+)\)/);
  if (!m) return [1, 0, 0, 1, 0, 0];
  const v = m[1].split(",").map(Number);
  return [v[0], v[1], v[2], v[3], v[4], v[5]];
}

export function initGlass(targets: HTMLElement[], wanted: { readonly matches: boolean }) {
  const img = document.getElementById("bg-img") as HTMLImageElement | null;
  const bg = img?.parentElement;
  const scrimEl = bg?.querySelector<HTMLElement>(".bg__scrim");
  if (!img || !bg || !scrimEl) return;
  const imgStyle = getComputedStyle(img);
  const bgBefore = getComputedStyle(bg, "::before");
  const scrimStyle = getComputedStyle(scrimEl);

  const panes = new Map<HTMLElement, Pane>();
  let source: Source | null = null;
  let raf = 0;

  /** 換了背景圖（或模糊半徑）就重做一次；清楚的那張縮成大約一個 CSS px 一個像素 */
  const prepare = (blurs: number[]): Source | null => {
    const src = img.currentSrc || img.src;
    if (!src || !img.complete || !img.naturalWidth) return null;
    const scale = Math.min(1, (img.offsetWidth * 1.1) / img.naturalWidth);
    const key = `${src}@${Math.round(img.naturalWidth * scale)}`;
    if (source?.key === key && blurs.every((b) => source!.frost.has(b))) return source;
    if (source?.key !== key) {
      for (const f of source?.frost.values() ?? []) URL.revokeObjectURL(f.url);
      const sharp = document.createElement("canvas");
      sharp.width = Math.max(1, Math.round(img.naturalWidth * scale));
      sharp.height = Math.max(1, Math.round(img.naturalHeight * scale));
      sharp.getContext("2d")!.drawImage(img, 0, 0, sharp.width, sharp.height);
      source = { key, sharp, frost: new Map() };
    }
    /** 圖片的一個像素是畫面上幾個 CSS px（cover 之後） */
    const cover = Math.max(img.offsetWidth / img.naturalWidth, img.offsetHeight / img.naturalHeight);
    for (const blur of blurs) {
      if (source.frost.has(blur)) continue;
      // 縮小到模糊半徑大約 3 個像素，模糊一小張圖就好
      const sigmaImg = Math.max(blur, 1) / cover;
      const f = Math.max(1, sigmaImg / 3);
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.round(img.naturalWidth / f));
      small.height = Math.max(1, Math.round(img.naturalHeight / f));
      small.getContext("2d")!.drawImage(img, 0, 0, small.width, small.height);
      const canvas = bake(small, Math.max(sigmaImg / f, 0.5));
      if (!canvas) continue;
      const entry = { canvas, url: "" };
      source.frost.set(blur, entry);
      // 霧面那層用一般的 <img>，所有卡片共用同一張解碼好的圖
      const owner = source;
      canvas.toBlob(
        (blob) => {
          if (!blob || source !== owner) return;
          entry.url = URL.createObjectURL(blob);
          for (const pane of panes.values()) pane.invalidate();
        },
        "image/jpeg",
        0.92,
      );
    }
    return source.frost.size ? source : null;
  };

  const blurOf = new Map<HTMLElement, number>();
  const radiusOf = new Map<HTMLElement, number>();
  const measure = (card: HTMLElement) => {
    const style = getComputedStyle(card);
    blurOf.set(card, Math.round(parseFloat(style.getPropertyValue("--blur")) || 0));
    radiusOf.set(card, parseFloat(style.borderTopLeftRadius) || 0);
  };

  const readScene = (): Scene | null => {
    // .bg__img 的排版大小，以及漂移動畫現在的 transform（以圖片中心為原點）
    const box = bg.getBoundingClientRect();
    const left = img.offsetLeft + box.left;
    const top = img.offsetTop + box.top;
    const bw = img.offsetWidth;
    const bh = img.offsetHeight;
    const [a, b, c, d, e, f] = matrixOf(imgStyle.transform);
    const cx = left + bw / 2;
    const cy = top + bh / 2;
    // 畫面上的點 P = C + M (Q - C) + t → Q = C + M⁻¹ (P - C - t)
    const det = a * d - b * c || 1;
    const ia = d / det;
    const ib = -b / det;
    const ic = -c / det;
    const id = a / det;
    // object-fit: cover
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const s = Math.max(bw / nw, bh / nh);
    const ox = left + (bw - nw * s) / 2;
    const oy = top + (bh - nh * s) / 2;
    const kx = 1 / (nw * s);
    const ky = 1 / (nh * s);
    const u: [number, number, number] = [ia * kx, ic * kx, (cx - ia * (cx + e) - ic * (cy + f) - ox) * kx];
    const v: [number, number, number] = [ib * ky, id * ky, (cy - ib * (cx + e) - id * (cy + f) - oy) * ky];
    const scrimRaw = parseColor(scrimStyle.backgroundColor);
    const scrim = saturate([scrimRaw[0], scrimRaw[1], scrimRaw[2], scrimRaw[3] * Number(scrimStyle.opacity)]);
    const page = saturate(parseColor(bgBefore.backgroundColor));
    const imgAlpha = Number(imgStyle.opacity);
    const imgLoaded = img.classList.contains("is-loaded");
    const src = prepare([...new Set(targets.map((t) => blurOf.get(t) ?? 0))]);
    return {
      key: `${u.join()}|${v.join()}|${scrim.join()}|${page.join()}|${imgAlpha}|${imgLoaded}|${src?.key}`,
      u,
      v,
      page,
      scrim,
      imgAlpha,
      imgLoaded,
      source: src,
    };
  };

  // 捲動是另一條執行緒在跑，畫布最快也晚一幀；手機、Safari 的平滑捲動會晚更多（還會忽快忽慢），
  // 邊緣的折射會很明顯跟不上。這些時候捲動中先把邊緣那層淡出（只剩對齊的霧面），停下來再畫好、淡回來。
  // 只有電腦上的 Chrome 捲動時一直重畫；掉幀的話也換成淡出（scripts/perf.ts 加上 .fade-rim）
  const root = document.documentElement;
  const touch = window.matchMedia("(pointer: coarse)");
  const chromium = isChromium();
  let scrolling = 0;
  const hideRim = (ms: number) => {
    clearTimeout(scrolling);
    root.classList.add("is-scrolling");
    scrolling = window.setTimeout(() => {
      scrolling = 0;
      root.classList.remove("is-scrolling");
    }, ms);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (touch.matches || !chromium || root.classList.contains("fade-rim")) hideRim(SCROLL_IDLE);
    },
    { passive: true },
  );
  // 觸控板可以拉過頁面的頭尾（彈一下），這時候頁面的捲動位置不會變、也沒有捲動事件，
  // 只有滾輪事件：拉過頭的時候也淡出，等彈回去再回來
  window.addEventListener(
    "wheel",
    (e) => {
      const max = root.scrollHeight - window.innerHeight;
      if ((e.deltaY < 0 && window.scrollY <= 0) || (e.deltaY > 0 && window.scrollY >= max - 1)) hideRim(OVERSCROLL_IDLE);
    },
    { passive: true },
  );

  const frame = () => {
    raf = 0;
    if (!wanted.matches) return;
    const scene = readScene();
    // 淡出的時候不用畫（還沒對齊、整張都用 WebGL 畫的卡片除外）
    if (scene) {
      for (const [card, pane] of panes) {
        if (!scrolling || pane.opaque) pane.draw(scene, blurOf.get(card) ?? 0, radiusOf.get(card) ?? 0);
      }
    }
    // 背景一秒會動 3 次、捲動和進場動畫也會移動卡片：每一幀看一下，沒變就不畫
    raf = requestAnimationFrame(frame);
  };

  const observer = new ResizeObserver((records) => {
    for (const r of records) measure(r.target as HTMLElement);
  });
  document.addEventListener("bg:change", () => {
    for (const pane of panes.values()) pane.resync();
  });

  const apply = () => {
    if (wanted.matches) {
      for (const card of targets) {
        if (panes.has(card)) continue;
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl", { antialias: false });
        if (!gl) continue;
        measure(card);
        observer.observe(card);
        panes.set(card, new Pane(card, gl, canvas));
      }
      if (!raf) raf = requestAnimationFrame(frame);
    } else {
      observer.disconnect();
      for (const pane of panes.values()) pane.destroy();
      panes.clear();
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  return apply;
}
