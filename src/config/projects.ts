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

// 首頁「做過的東西」：挑幾個想給人看的就好，建議 4–6 個
export const projects: Project[] = [
  {
    name: "renexmoe TW527E Edition",
    description: "幫 OneManager 換上好看的外皮，拿來當網盤門面剛剛好。",
    url: "https://github.com/TW527E/renexmoe-tw527e-edition",
    language: "HTML",
    badge: "最多人收藏",
    logo: renexmoe,
  },
  {
    name: "ShiftIME",
    description: "在 Mac 上單按 Shift 就能切中英文，跟 Windows 一樣順手。",
    url: "https://github.com/TW527E/ShiftIME",
    language: "Swift",
    logo: shiftime,
  },
  {
    name: "Wherry",
    description: "在 X 發完文，自動幫你同步到 Bluesky、Sharkey 和 Telegram。",
    url: "https://github.com/TW527E/Wherry",
    language: "TypeScript",
    logo: wherry,
    logoFill: true,
  },
  {
    name: "Rebocap × VRChat on Linux",
    description: "在 Linux 上用 Rebocap 全身追蹤玩 VRChat，踩過的坑和腳本都在這。",
    url: "https://github.com/TW527E/rebocap-linux-vrchat-fbt",
    language: "Shell",
    icon: "PersonStanding",
  },
  {
    name: "Bilibili YouTube Volume",
    description: "把 YouTube 那種好調的音量條搬到 B 站，晚上看片不怕突然爆音。",
    url: "https://github.com/TW527E/bilibili-youtube-volume",
    language: "JavaScript",
    icon: "Volume2",
  },
  {
    name: "Bahamut Auto Bump",
    description: "每天幫巴哈的文章推一下，推完還會傳 Telegram 跟你說一聲。",
    url: "https://github.com/TW527E/Bahamut-Auto-Bump",
    language: "Python",
    icon: "ThumbsUp",
  },
];
