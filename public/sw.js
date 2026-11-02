// 舊主頁（imsyy/home）用 vite-plugin-pwa 在訪客的瀏覽器裝了 Service Worker（/sw.js），
// 它會一直拿快取裡的舊網頁出來，所以看過舊主頁的人會卡在舊的「加載中」，F5 也沒用。
//
// 新網站不用 Service Worker。這個檔案是用來「拆掉」舊的：
// 瀏覽器每次打開網站都會回來檢查 /sw.js 有沒有更新，一拿到這份就會換上它，
// 然後清掉舊的快取、取消註冊，再把開著的分頁重新整理一次，之後就是一般的網頁了。
// 舊主頁的訪客都換過來之前，這個檔案要一直留著。

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) client.navigate(client.url);
    })(),
  );
});
