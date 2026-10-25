const CACHE = "asobi-roulette-v2";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "buhio/waving.webp", "buhio/pointing.webp", "buhio/surprised.webp", "buhio/jumping.webp", "buhio/standing.webp"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// 通信できるときは最新を取り、だめならキャッシュ（更新が反映されやすい）
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
