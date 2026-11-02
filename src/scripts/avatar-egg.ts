// 彩蛋：連點頭像三下，頭像會轉一圈、噴出一小把彩色碎片，再冒出一句話。
// 要求減少動態效果時只冒那句話。
// 碎片和那句話都放在卡片裡、對著頭像擺，捲動時會跟著頭像走。

import { site } from "../config/site";

/** 兩下之間最多隔多久（ms）還算連點 */
const GAP = 500;
const BITS = 16;
/** 那句話離頭像多遠（px），留空間給轉圈時放大的頭像 */
const BUBBLE_GAP = 18;
/** 那句話離畫面邊緣至少多遠（px），上面放不下就改放頭像下面 */
const EDGE = 8;
/** 隨機挑一句，不會連續兩次一樣。想加就直接加，一句最好不超過 18 個字（手機才放得下） */
const LINES = [
  "啊，被發現了！",
  "欸？你怎麼知道這裡可以點",
  "好啦好啦，被你抓包了",
  "一直點我會暈啦 @_@",
  "今天也辛苦啦～",
  "來 osu! 打一把嗎？",
  "來 Discord 聊天嗎？",
  `偷偷說，這個主頁 ${site.since.slice(0, 4)} 年就開了`,
  "你有發現我的網址是 .zip 結尾嗎？",
  "熱知識：我玩 VRChat 是用 Linux",
  "在 VRChat 裝全身追蹤，就是為了讓大家看到我躺平（",
  "還不快來 Lunlun's World 玩！",
  "用 Mac 我也要按 Shift 切輸入法",
];

export function initAvatarEgg() {
  const avatar = document.querySelector<HTMLElement>(".avatar");
  if (!avatar) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let count = 0;
  let last = 0;
  let line = -1;
  let bubble: HTMLElement | null = null;
  let bubbleTimer = 0;

  /** 放碎片和那句話的地方：頭像所在的卡片（position: relative） */
  const host = () => (avatar.offsetParent as HTMLElement | null) ?? document.body;
  /** 頭像中心在卡片裡的位置 */
  const center = () => ({ x: avatar.offsetLeft + avatar.offsetWidth / 2, y: avatar.offsetTop + avatar.offsetHeight / 2 });

  const burst = () => {
    const { x, y } = center();
    const box = document.createElement("div");
    box.className = "egg-burst";
    box.setAttribute("aria-hidden", "true");
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    for (let i = 0; i < BITS; i++) {
      const bit = document.createElement("span");
      // 四種顏色、一半圓點一半星星
      bit.className = `egg-bit egg-bit--${i % 4}${i % 2 ? " egg-bit--star" : ""}`;
      const angle = (i / BITS) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 50;
      bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      bit.style.setProperty("--spin", `${Math.round(Math.random() * 360 - 180)}deg`);
      box.append(bit);
    }
    host().append(box);
    window.setTimeout(() => box.remove(), 1200);
  };

  const say = () => {
    bubble?.remove();
    clearTimeout(bubbleTimer);
    let next = Math.floor(Math.random() * (LINES.length - 1));
    if (next >= line) next++;
    line = next;
    bubble = document.createElement("p");
    bubble.className = "egg-bubble";
    bubble.setAttribute("role", "status");
    bubble.textContent = LINES[line];
    const { x } = center();
    bubble.style.left = `${x}px`;
    bubble.style.top = `${avatar.offsetTop - BUBBLE_GAP}px`;
    host().append(bubble);
    // 頭像上面放不下（捲下去了、或貼著畫面頂端）：改放頭像下面
    if (bubble.getBoundingClientRect().top < EDGE) {
      bubble.classList.add("is-below");
      bubble.style.top = `${avatar.offsetTop + avatar.offsetHeight + BUBBLE_GAP}px`;
    }
    const current = bubble;
    bubbleTimer = window.setTimeout(() => {
      current.classList.add("is-leaving");
      window.setTimeout(() => current.remove(), 300);
    }, 2400);
  };

  const party = () => {
    say();
    if (reduce.matches) return;
    // 先拿掉再加回去，連續觸發也會重新轉
    avatar.classList.remove("is-party");
    void avatar.offsetWidth;
    avatar.classList.add("is-party");
    burst();
  };

  avatar.addEventListener("animationend", () => avatar.classList.remove("is-party"));
  // 連點時瀏覽器會順手選取旁邊的字，擋掉
  avatar.addEventListener("mousedown", (e) => {
    if (e.detail > 1) e.preventDefault();
  });
  avatar.addEventListener("click", () => {
    const now = performance.now();
    count = now - last < GAP ? count + 1 : 1;
    last = now;
    if (count >= 3) {
      count = 0;
      party();
    }
  });
}
