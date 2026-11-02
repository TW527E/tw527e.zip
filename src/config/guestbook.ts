// 留言板（留句話給我 → 變成彈幕）
// 後端是 worker/messages.ts。D1 第一次部署時會自動建好，Turnstile 要自己到 Cloudflare 後台設定，步驟見 README。

export const guestbook = {
  /** 不想要留言板就改成 false，整塊和彈幕都不會出現 */
  enabled: true,
  /**
   * Turnstile 的 site key（公開的那把，可以寫在這裡）。
   * 預設是 Cloudflare 的測試用 key，只能在本機測試；上線前換成自己的。
   */
  turnstileSiteKey: "0x4AAAAAAFvH8-DvsrldMwL3",
  api: "/api/messages",
};
