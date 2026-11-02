// 實驗：用 WebGL 畫玻璃的折射（網址加 ?gl 才會用）。
//
// 玻璃後面只有一張背景圖，所以不用截網頁：直接把背景圖交給 GPU，
// 每張卡片放一張自己的畫布，算出卡片底下那塊背景折射、色散、模糊之後的樣子。
// - 畫布跟著卡片捲動，形狀不會落後；只有畫布裡的背景位置是下一幀才更新（反正是模糊的）。
// - 沒有 backdrop-filter，卡片上的字、高光、游標重畫時，不用跟著重算玻璃。
// - Safari、Firefox 也一樣有真的折射和色散。
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
/** 畫布最多用幾倍解析度 */
const MAX_DPR = 2;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const GLASS = `
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
uniform vec4 uPage;     // 圖片還沒出來時的底色
uniform vec4 uScrim;    // 背景上的遮罩（a 已乘上透明度）
uniform float uImgAlpha;
uniform float uBand;
uniform float uStrength;
uniform float uChroma;
uniform float uEdge;
uniform float uSpec;
uniform vec2 uLight;

const float K = ${CURVATURE.toFixed(1)};
const float IOR = ${IOR.toFixed(3)};

vec2 toUv(vec2 p) { vec3 h = vec3(p, 1.0); return vec2(dot(uU, h), dot(uV, h)); }

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
    vec3 s = mix(texture2D(uSharp, uv).rgb, texture2D(uBlur, uv).rgb, frost);
    if (i == 0) col.r = s.r; else if (i == 1) col.g = s.g; else col.b = s.b;
  }
  col = mix(uPage.rgb, col, uImgAlpha);
  col = mix(col, uScrim.rgb, uScrim.a);
  // 跟 CSS 的 saturate(180%) 一樣
  float lum = dot(col, vec3(0.213, 0.715, 0.072));
  col = lum + (col - lum) * 1.8;

  float d = max(depth, 0.0);
  float crisp = max(0.0, 1.0 - d / ${SPECULAR_WIDTH.toFixed(2)});
  float glow = max(0.0, 1.0 - d / ${(SPECULAR_WIDTH * 5).toFixed(2)});
  float rim = uSpec * (crisp * crisp + 0.3 * glow * glow);
  float facing = dot(n, uLight);
  float shade = 0.12 + 0.88 * (facing > 0.0 ? facing : -0.4 * facing);
  col += min(1.0, rim * shade);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/** 背景圖準備好給 GPU 的樣子（每換一張圖做一次，所有卡片共用） */
interface Source {
  key: string;
  sharp: HTMLCanvasElement;
  /** 依模糊半徑分開做：先縮小、再在 GPU 上模糊 */
  small: Map<number, { canvas: HTMLCanvasElement; sigma: number }>;
}

/** 從畫面座標換到背景圖座標要用的資料（每一幀讀一次） */
interface Scene {
  key: string;
  ready: boolean;
  u: [number, number, number];
  v: [number, number, number];
  page: [number, number, number, number];
  scrim: [number, number, number, number];
  imgAlpha: number;
  source: Source | null;
}

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const colors = new Map<string, [number, number, number, number]>();
/** 任何 CSS 顏色 → 0–1 的 RGBA */
function parseColor(css: string): [number, number, number, number] {
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

function compile(gl: WebGLRenderingContext, vert: string, frag: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vert],
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

const GAUSS = `
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSize;
uniform vec2 uDir;
uniform float uSigma;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -24; i <= 24; i++) {
    float x = float(i);
    if (abs(x) > uSigma * 3.0) continue;
    float w = exp(-x * x / (2.0 * uSigma * uSigma));
    sum += texture2D(uSrc, uv + uDir * x / uSize) * w;
    total += w;
  }
  gl_FragColor = sum / total;
}
`;

/** 一張卡片的畫布 */
class Pane {
  readonly box: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private glass: WebGLProgram;
  private gauss: WebGLProgram;
  private loc = new Map<string, WebGLUniformLocation | null>();
  private sharp: WebGLTexture | null = null;
  private blur: WebGLTexture | null = null;
  private sourceKey = "";
  private drawn = "";
  lost = false;

  constructor(
    readonly card: HTMLElement,
    gl: WebGLRenderingContext,
    canvas: HTMLCanvasElement,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.glass = compile(gl, VERT, GLASS);
    this.gauss = compile(gl, VERT, GAUSS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // 一個蓋滿畫面的三角形
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.box = document.createElement("div");
    this.box.className = "refract-mirror";
    this.box.setAttribute("aria-hidden", "true");
    canvas.className = "refract-mirror__gl";
    this.box.append(canvas);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      delete card.dataset.refractReady;
    });
    card.prepend(this.box);
  }

  private u(program: WebGLProgram, name: string) {
    const id = `${program === this.glass ? "g" : "b"}:${name}`;
    if (!this.loc.has(id)) this.loc.set(id, this.gl.getUniformLocation(program, name));
    return this.loc.get(id) ?? null;
  }

  /** 換了背景圖或模糊半徑：重新上傳、重新模糊 */
  private upload(source: Source, blurPx: number) {
    const gl = this.gl;
    const key = `${source.key}|${blurPx}`;
    if (this.sourceKey === key) return;
    this.sourceKey = key;
    if (this.sharp) gl.deleteTexture(this.sharp);
    if (this.blur) gl.deleteTexture(this.blur);
    this.sharp = texture(gl, source.sharp);
    const small = source.small.get(blurPx)!;
    const w = small.canvas.width;
    const h = small.canvas.height;
    const input = texture(gl, small.canvas);
    const tmp = texture(gl, null, w, h);
    const out = texture(gl, null, w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.gauss);
    gl.uniform1i(this.u(this.gauss, "uSrc"), 0);
    gl.uniform2f(this.u(this.gauss, "uSize"), w, h);
    gl.uniform1f(this.u(this.gauss, "uSigma"), small.sigma);
    for (const [from, to, dx, dy] of [
      [input, tmp, 1, 0],
      [tmp, out, 0, 1],
    ] as const) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, to, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from);
      gl.uniform2f(this.u(this.gauss, "uDir"), dx, dy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(input);
    gl.deleteTexture(tmp);
    this.blur = out;
  }

  draw(scene: Scene, blurPx: number, radius: number) {
    if (this.lost) return;
    const rect = this.card.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const key = `${scene.key}|${rect.left},${rect.top},${rect.width},${rect.height}|${radius}|${blurPx}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(this.card.offsetWidth * dpr);
    const h = Math.round(this.card.offsetHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (scene.source) this.upload(scene.source, blurPx);
    const g = this.glass;
    gl.useProgram(g);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blur);
    gl.uniform1i(this.u(g, "uSharp"), 0);
    gl.uniform1i(this.u(g, "uBlur"), 1);
    gl.uniform2f(this.u(g, "uCanvas"), w, h);
    gl.uniform1f(this.u(g, "uDpr"), w / this.card.offsetWidth);
    // 卡片可能正在做進場動畫（有縮放），形狀用排版的大小，位置用畫面上的位置
    gl.uniform2f(this.u(g, "uSize"), this.card.offsetWidth, this.card.offsetHeight);
    gl.uniform1f(this.u(g, "uRadius"), radius);
    gl.uniform2f(this.u(g, "uOrigin"), rect.left, rect.top);
    gl.uniform3f(this.u(g, "uU"), ...scene.u);
    gl.uniform3f(this.u(g, "uV"), ...scene.v);
    gl.uniform4f(this.u(g, "uPage"), ...scene.page);
    gl.uniform4f(this.u(g, "uScrim"), ...scene.scrim);
    gl.uniform1f(this.u(g, "uImgAlpha"), scene.source ? scene.imgAlpha : 0);
    gl.uniform1f(this.u(g, "uBand"), BAND);
    gl.uniform1f(this.u(g, "uStrength"), STRENGTH);
    gl.uniform1f(this.u(g, "uChroma"), CHROMA);
    gl.uniform1f(this.u(g, "uEdge"), EDGE);
    gl.uniform1f(this.u(g, "uSpec"), SPECULAR);
    const a = (LIGHT_ANGLE * Math.PI) / 180;
    gl.uniform2f(this.u(g, "uLight"), Math.cos(a), Math.sin(a));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.card.dataset.refractReady = "";
  }

  destroy() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.box.remove();
    delete this.card.dataset.refractReady;
  }
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
function matrixOf(css: string): [number, number, number, number, number, number] {
  const m = css.match(/matrix\(([^)]+)\)/);
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

  /** 背景圖縮成大約一個 CSS px 一個像素：卡片都有模糊，不用更細 */
  const prepare = (blurs: number[]): Source | null => {
    const src = img.currentSrc || img.src;
    if (!src || !img.complete || !img.naturalWidth) return null;
    const boxW = img.offsetWidth;
    const scale = Math.min(1, (boxW * 1.1) / img.naturalWidth);
    const key = `${src}@${Math.round(img.naturalWidth * scale)}`;
    if (source?.key === key && blurs.every((b) => source!.small.has(b))) return source;
    const sharp = document.createElement("canvas");
    sharp.width = Math.max(1, Math.round(img.naturalWidth * scale));
    sharp.height = Math.max(1, Math.round(img.naturalHeight * scale));
    sharp.getContext("2d")!.drawImage(img, 0, 0, sharp.width, sharp.height);
    /** 圖片的一個像素是畫面上幾個 CSS px（cover 之後） */
    const cover = Math.max(img.offsetWidth / img.naturalWidth, img.offsetHeight / img.naturalHeight);
    const small = new Map<number, { canvas: HTMLCanvasElement; sigma: number }>();
    for (const blur of blurs) {
      // 縮小到模糊半徑大約 3 個像素，GPU 只要模糊一小張圖
      const sigmaImg = blur / cover;
      const f = Math.max(1, sigmaImg / 3);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth / f));
      canvas.height = Math.max(1, Math.round(img.naturalHeight / f));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      small.set(blur, { canvas, sigma: Math.max(sigmaImg / f, 0.5) });
    }
    source = { key, sharp, small };
    return source;
  };

  const blurOf = new Map<HTMLElement, number>();
  const radiusOf = new Map<HTMLElement, number>();
  const measure = (card: HTMLElement) => {
    const style = getComputedStyle(card);
    blurOf.set(card, Math.round(parseFloat(style.getPropertyValue("--blur")) || 0));
    radiusOf.set(card, parseFloat(style.borderTopLeftRadius) || 0);
  };

  const readScene = (): Scene => {
    // .bg__img 的排版大小，以及漂移動畫現在的 transform（以圖片中心為原點）
    const left = img.offsetLeft + bg.getBoundingClientRect().left;
    const top = img.offsetTop + bg.getBoundingClientRect().top;
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
    // uv.x = (Qx - ox) / (nw s)，Qx = cx + ia (Px - cx - e) + ic (Py - cy - f)
    const kx = 1 / (nw * s);
    const ky = 1 / (nh * s);
    const u: [number, number, number] = [ia * kx, ic * kx, (cx - ia * (cx + e) - ic * (cy + f) - ox) * kx];
    const v: [number, number, number] = [ib * ky, id * ky, (cy - ib * (cx + e) - id * (cy + f) - oy) * ky];
    const scrim = parseColor(scrimStyle.backgroundColor);
    const scrimA = scrim[3] * Number(scrimStyle.opacity);
    const page = parseColor(bgBefore.backgroundColor);
    const imgAlpha = Number(imgStyle.opacity);
    const blurs = [...new Set(targets.map((t) => blurOf.get(t) ?? 0))];
    const src = prepare(blurs);
    return {
      key: `${u.join()}|${v.join()}|${scrim.join()}|${scrimA}|${page.join()}|${imgAlpha}|${src?.key}`,
      ready: !!src,
      u,
      v,
      page,
      scrim: [scrim[0], scrim[1], scrim[2], scrimA],
      imgAlpha,
      source: src,
    };
  };

  const frame = () => {
    raf = 0;
    if (!wanted.matches) return;
    const scene = readScene();
    for (const [card, pane] of panes) pane.draw(scene, blurOf.get(card) ?? 0, radiusOf.get(card) ?? 0);
    // 背景一秒會動 3 次、捲動和進場動畫也會移動卡片：每一幀看一下，沒變就不畫
    raf = requestAnimationFrame(frame);
  };

  const observer = new ResizeObserver((records) => {
    for (const r of records) measure(r.target as HTMLElement);
  });

  const apply = () => {
    if (wanted.matches) {
      for (const card of targets) {
        if (panes.has(card)) continue;
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
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
