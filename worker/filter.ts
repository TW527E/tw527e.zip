// 留言內容的整理與檢查。前端也會先擋一次，但以這裡為準。

export const MAX_LENGTH = 30;
/** 署名最多幾個字 */
export const MAX_NAME_LENGTH = 12;

// 擋掉的詞：髒話、人身攻擊和常見的廣告詞。比對前會轉小寫、拿掉空白和標點，
// 所以「幹 你 娘」「f.u.c.k」也會被擋。想加就往裡面加。
const BLOCKED = [
  // 髒話、人身攻擊（繁簡都放）
  "幹你娘", "干你娘", "操你媽", "操你妈", "肏你", "草泥馬", "草泥马", "你媽死", "你妈死", "雞巴", "鸡巴",
  "傻逼", "傻屄", "煞筆", "煞笔", "腦殘", "脑残", "智障", "婊子", "賤人", "贱人", "去死",
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "retard",
  // 廣告
  "加賴", "加line", "加我line", "加微信", "博彩", "賭場", "赌场", "代購", "代购", "約炮", "约炮", "色情", "成人影片",
];

// 網址、網域：彈幕不給放連結
const LINK = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|xyz|cn|tw|hk|me|cc|top|zip|link|ly|gg|app|dev|site|shop|vip)\b)/i;

/** 整理留言：統一字形、拿掉控制字元和零寬字元、把連續空白縮成一個 */
export function normalize(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 連結、髒話、廣告詞的共同檢查 */
function unfriendly(text: string, what: string): string | null {
  if (LINK.test(text)) return `${what}裡不能放連結喔`;
  // 比對時才把全形英數轉成半形（ｆｕｃｋ → fuck），存下來的字保持原樣，中文標點才不會被改掉
  const squashed = text.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  if (BLOCKED.some((word) => squashed.includes(word))) return `這${what === "署名" ? "個署名" : "句話"}有點不友善，換個說法吧`;
  return null;
}

/** 回傳這句話不能留的原因，沒問題回傳 null */
export function reject(text: string): string | null {
  const length = Array.from(text).length;
  if (length === 0) return "還沒寫東西喔";
  if (length > MAX_LENGTH) return `太長了，最多 ${MAX_LENGTH} 個字`;
  return unfriendly(text, "彈幕");
}

/** 署名可以不填；有填的話回傳不能用的原因，沒問題回傳 null */
export function rejectName(name: string): string | null {
  if (name === "") return null;
  if (Array.from(name).length > MAX_NAME_LENGTH) return `署名最多只能 ${MAX_NAME_LENGTH} 個字`;
  return unfriendly(name, "署名");
}
