// 玻璃邊緣的高光跟著滑鼠走；沒在動滑鼠（或是用手機）時，交給 CSS 動畫自己慢慢飄。
export function initPointerLight() {
  const root = document.documentElement;
  root.classList.add("light-idle");
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let x = 0;
  let y = 0;
  let raf = 0;
  const write = () => {
    raf = 0;
    root.style.setProperty("--mx", `${x}px`);
    root.style.setProperty("--my", `${y}px`);
  };

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      root.classList.remove("light-idle");
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(write);
    },
    { passive: true },
  );
  root.addEventListener("pointerleave", () => root.classList.add("light-idle"));
}
