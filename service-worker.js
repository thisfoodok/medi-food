const CACHE_NAME = "eat-ok-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/lookup.js",
  "./js/matcher.js",
  "./js/app.js",
  "./data/products.json",
  "./data/interactions.json",
  "./manifest.json"
];

// 설치 시 필요한 파일들을 캐시에 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 오래된 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 요청이 오면 캐시 먼저, 없으면 네트워크
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
