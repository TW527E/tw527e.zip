import type { ImageMetadata } from "astro";
import type * as icons from "lucide-static";
import renexmoe from "../assets/projects/renexmoe.png";
import shiftime from "../assets/projects/shiftime.png";
import wherry from "../assets/projects/wherry.svg";

export interface Project {
  name: string;
  description: string;
  url: string;
  language: string;
  /** 小標籤，例如「最多人收藏」，可省略 */
  badge?: string;
  /** 專案的 Logo（放在 src/assets/projects/），沒有就省略 */
  logo?: ImageMetadata;
  /** Logo 是滿版的方形圖（例如 Wherry），就設成 true，會裁成圓角方塊 */
  logoFill?: boolean;
  /** 沒有 Logo 時顯示的 Lucide 圖示，省略就用 Code */
  icon?: keyof typeof icons;
}

// 首頁「我做的小東西」：挑幾個想給人看的就好，建議 4–6 個
export const projects: Project[] = [
  {
    name: "renexmoe TW527E Edition",
    description: "給 OneManager 用的主題，讓網盤的首頁好看一點。",
    url: "https://github.com/TW527E/renexmoe-tw527e-edition",
    language: "HTML",
    badge: "收藏最多",
    logo: renexmoe,
  },
  {
    name: "ShiftIME",
    description: "讓 Mac 也能像 Windows 一樣，按一下 Shift 就切換中英文。",
    url: "https://github.com/TW527E/ShiftIME",
    language: "Swift",
    logo: shiftime,
  },
  {
    name: "Wherry",
    description: "在 X 發的文，會自動轉貼到 Bluesky、Sharkey 和 Telegram。",
    url: "https://github.com/TW527E/Wherry",
    language: "TypeScript",
    logo: wherry,
    logoFill: true,
  },
  {
    name: "Rebocap × VRChat on Linux",
    description: "在 Linux 上靠 Rebocap 全身追蹤玩 VRChat，用到的腳本和踩過的坑都放在這。",
    url: "https://github.com/TW527E/rebocap-linux-vrchat-fbt",
    language: "Shell",
    icon: "PersonStanding",
  },
  {
    name: "Bilibili YouTube Volume",
    description: "把 B 站的音量條換成 YouTube 那種比較好調的，半夜看影片不會突然被嚇到。",
    url: "https://github.com/TW527E/bilibili-youtube-volume",
    language: "JavaScript",
    icon: "Volume2",
  },
  {
    name: "Bahamut Auto Bump",
    description: "每天自動幫你推巴哈的文章，推完會傳 Telegram 通知你。",
    url: "https://github.com/TW527E/Bahamut-Auto-Bump",
    language: "Python",
    icon: "ThumbsUp",
  },
];
