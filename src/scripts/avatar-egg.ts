// 彩蛋：連點頭像三下，頭像會轉一圈、噴出一小把彩色碎片，再冒出一句話。
// 要求減少動態效果時只冒那句話。

/** 兩下之間最多隔多久（ms）還算連點 */
const GAP = 500;
const BITS = 16;
const LINES = ["被你發現了！", "再點我要暈了啦 @_@", "嘿嘿，這是隱藏彩蛋", "今天也辛苦了～"];

export function initAvatarEgg() {
  const avatar = document.querySelector<HTMLElement>(".avatar");
  if (!avatar) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let count = 0;
  let last = 0;
  let line = 0;
  let bubble: HTMLElement | null = null;
  let bubbleTimer = 0;

  const burst = (cx: number, cy: number) => {
    const box = document.createElement("div");
    box.className = "egg-burst";
    box.setAttribute("aria-hidden", "true");
    box.style.left = `${cx}px`;
    box.style.top = `${cy}px`;
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
    document.body.append(box);
    window.setTimeout(() => box.remove(), 1200);
  };

  const say = (rect: DOMRect) => {
    bubble?.remove();
    clearTimeout(bubbleTimer);
    bubble = document.createElement("p");
    bubble.className = "egg-bubble";
    bubble.setAttribute("role", "status");
    bubble.textContent = LINES[line++ % LINES.length];
    bubble.style.left = `${rect.left + rect.width / 2}px`;
    // 留空間給轉圈時放大的頭像
    bubble.style.top = `${rect.top - 18}px`;
    document.body.append(bubble);
    const current = bubble;
    bubbleTimer = window.setTimeout(() => {
      current.classList.add("is-leaving");
      window.setTimeout(() => current.remove(), 300);
    }, 2400);
  };

  const party = () => {
    const rect = avatar.getBoundingClientRect();
    say(rect);
    if (reduce.matches) return;
    // 先拿掉再加回去，連續觸發也會重新轉
    avatar.classList.remove("is-party");
    void avatar.offsetWidth;
    avatar.classList.add("is-party");
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
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
