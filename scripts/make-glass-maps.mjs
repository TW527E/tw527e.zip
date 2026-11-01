// 產生 liquid glass 折射用的位移貼圖碎片（四個圓角 + 四條邊），輸出到 public/glass/。
// 瀏覽器的 backdrop-filter 只肯讀同網域的圖片檔（data: / blob: 都不行），
// 所以不能在前端即時畫，改成先做好碎片，再由 src/scripts/liquid.ts 依卡片尺寸拼起來。
// R/G 通道 = x/y 位移，128 為不動；越靠近邊緣，往內折射越多。
// 用法：node scripts/make-glass-maps.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/** 卡片圓角（px），要跟 CSS 裡有 data-refract 的卡片一致 */
const RADII = [28, 32];
/** 折射帶寬度（px），要跟 liquid.ts 的 BAND 一致 */
const BAND = 34;
/** 輸出解析度倍數 */
const SCALE = 2;
const OUT = "public/glass";

// 圓角矩形的有號距離（內部為負，單位 px）與外法線
function sdf(x, y, hw, hh, r) {
  const qx = Math.abs(x) - (hw - r);
  const qy = Math.abs(y) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const outside = Math.hypot(ox, oy);
  const inside = Math.min(Math.max(qx, qy), 0);
  let nx = 0;
  let ny = 0;
  if (outside > 0) {
    nx = ox / outside;
    ny = oy / outside;
  } else if (qx > qy) {
    nx = 1;
  } else {
    ny = 1;
  }
  return { d: outside + inside - r, nx: nx * Math.sign(x || 1), ny: ny * Math.sign(y || 1) };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** 把一塊區域畫成 PNG。(x0, y0) 是這塊在虛擬卡片上的左上角（px） */
function render(file, x0, y0, w, h, card, r) {
  const W = w * SCALE;
  const H = h * SCALE;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let py = 0; py < H; py++) {
    const row = py * (W * 3 + 1);
    for (let px = 0; px < W; px++) {
      const x = x0 + (px + 0.5) / SCALE - card / 2;
      const y = y0 + (py + 0.5) / SCALE - card / 2;
      const { d, nx, ny } = sdf(x, y, card / 2, card / 2, r);
      const t = Math.min(Math.max(-d / BAND, 0), 1); // 0 = 邊緣, 1 = 折射帶內側
      const k = d > 0 ? 1 : (1 - t) ** 1.6; // 越靠邊越強
      const i = row + 1 + px * 3;
      raw[i] = Math.round(128 - nx * k * 127);
      raw[i + 1] = Math.round(128 - ny * k * 127);
      raw[i + 2] = 128;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(`${OUT}/${file}`, png);
}

mkdirSync(OUT, { recursive: true });
for (const r of RADII) {
  const c = Math.max(r, BAND); // 圓角碎片的邊長
  const card = c * 4; // 虛擬卡片，夠大就好
  const mid = card / 2;
  render(`r${r}-tl.png`, 0, 0, c, c, card, r);
  render(`r${r}-tr.png`, card - c, 0, c, c, card, r);
  render(`r${r}-bl.png`, 0, card - c, c, c, card, r);
  render(`r${r}-br.png`, card - c, card - c, c, c, card, r);
  // 邊只要一小段，瀏覽器會把它拉長
  render(`r${r}-t.png`, mid - 2, 0, 4, c, card, r);
  render(`r${r}-b.png`, mid - 2, card - c, 4, c, card, r);
  render(`r${r}-l.png`, 0, mid - 2, c, 4, card, r);
  render(`r${r}-r.png`, card - c, mid - 2, c, 4, card, r);
  console.log(`r${r}: 8 pieces, corner ${c}px`);
}
