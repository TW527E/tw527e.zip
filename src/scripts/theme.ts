export type Tone = "light" | "dark";

/** 目前實際套用的是淺色還是深色（考慮使用者選擇與系統設定） */
export function currentTone(): Tone {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 主題改變時通知（按鈕切換或系統切換） */
export function onToneChange(cb: (tone: Tone) => void) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => cb(currentTone()));
  document.addEventListener("theme:change", () => cb(currentTone()));
}
