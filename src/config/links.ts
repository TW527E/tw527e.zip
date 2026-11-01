import { siBilibili, siDiscord, siGithub, siOsu, siSteam, siQq, siTelegram, siVrchat, siWechat, siX } from "simple-icons";
import { site } from "./site";

export interface SocialLink {
  name: string;
  url: string;
  /** simple-icons 的 SVG path */
  icon: string;
}

// 個人卡上那一排圓形圖示
export const socialLinks: SocialLink[] = [
  { name: "GitHub", url: "https://github.com/TW527E", icon: siGithub.path },
  { name: "VRChat", url: "https://vrchat.com/home/user/usr_086517a9-e1c3-4b4a-a35a-d8453e62b674", icon: siVrchat.path },
  { name: "osu!", url: "https://osu.ppy.sh/users/13903088", icon: siOsu.path },
  { name: "Steam", url: "https://steamcommunity.com/id/TW527E/", icon: siSteam.path },
  { name: "Bilibili", url: "https://space.bilibili.com/453006174", icon: siBilibili.path },
  { name: "X", url: "https://x.com/TW527E", icon: siX.path },
  { name: "Telegram", url: "https://t.me/tw527e", icon: siTelegram.path },
];

export interface Contact {
  name: string;
  value: string;
  /** 複製按鈕的說明，例如「Discord 帳號」 */
  copyLabel: string;
  /** 點帳號本身時開啟的連結，沒有就只能複製 */
  url?: string;
  icon: string;
  /** 圖示要用 evenodd 填色時設 true */
  evenOdd?: boolean;
}

// 「找我聊天」聯絡卡，第一個是預設顯示的
export const contacts: Contact[] = [
  {
    name: "Email",
    value: site.email,
    copyLabel: "Email",
    url: `mailto:${site.email}`,
    icon: "M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 4.2V19h16V7.2l-8 5.6-8-5.6zM5.2 5 12 9.8 18.8 5H5.2z",
    evenOdd: true,
  },
  { name: "Discord", value: "tw527e", copyLabel: "Discord 帳號", icon: siDiscord.path },
  { name: "WeChat", value: "tw527e", copyLabel: "WeChat 帳號", icon: siWechat.path },
  // QQ 官方「加好友 / 發訊息」連結（會開啟 QQ）
  {
    name: "QQ",
    value: "3677572253",
    copyLabel: "QQ 號",
    url: "https://wpa.qq.com/msgrd?v=3&uin=3677572253&site=qq&menu=yes",
    icon: siQq.path,
  },
];

export interface NavLink {
  name: string;
  description: string;
  url: string;
  /** lucide-static 的圖示名稱 */
  icon: "BookOpen" | "Activity" | "Globe" | "Camera" | "Music";
}

// 「我的其他地方」：想加頁面就往下加一筆
export const navLinks: NavLink[] = [
  { name: "部落格", description: "想到什麼就寫什麼的地方", url: "https://blog.tw527e.zip/", icon: "BookOpen" },
  { name: "網站狀態", description: "看看我的服務今天有沒有在偷懶", url: "https://status.tw527e.zip/", icon: "Activity" },
];
