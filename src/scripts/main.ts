import { site } from "../config/site";
import { initAvatarEgg } from "./avatar-egg";
import { initCopyButtons } from "./copy";
import { initCursor } from "./cursor";
import { initDanmaku } from "./danmaku";
import { initGuestbook } from "./guestbook";
import { initLiquid } from "./liquid";
import { initOverscroll } from "./overscroll";
import { initPerf } from "./perf";
import { initPointerLight } from "./pointer-light";

// 要在 initLiquid 之前：記得是輕量模式的話，一開始就不做折射
initPerf();
initLiquid();
initPointerLight();
initCursor();
initOverscroll();
initCopyButtons();
initAvatarEgg();
initGuestbook();
initDanmaku();

console.log(
  `%c ${site.title} %c v${__APP_VERSION__} `,
  "background:#9c3f14;color:#fff;padding:4px 6px;border-radius:6px 0 0 6px",
  "background:#14161c;color:#fff;padding:4px 6px;border-radius:0 6px 6px 0",
);
console.log(`嗨～想看這個網站怎麼做的話，原始碼在這：${site.repo}`);
