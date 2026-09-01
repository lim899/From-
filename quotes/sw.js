/* 离线缓存：应用外壳走缓存优先，句子本身存在 localStorage，与这里无关 */
/* v2：应用从站点根目录搬到 /quotes/，换个缓存名，跟根目录留下的旧缓存划清界限 */
var CACHE = 'jinju-v2';
var SHELL = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 分享/快捷添加带着 query 进来，忽略 query 匹配缓存里的首页
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return req.mode === 'navigate' ? caches.match('./index.html') : Response.error();
      });
    })
  );
});
