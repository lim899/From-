/*
 * 自毁 Service Worker。
 *
 * 金句收藏夹原先住在站点根目录，会在这里注册一个 scope 为 "/" 的 Service Worker。
 * 应用搬到 /quotes/ 之后，那些已经装过旧版的浏览器里还留着它，而它是缓存优先的，
 * 会继续拿缓存里的旧首页盖住新的个人主页。
 *
 * 浏览器检查更新时会重新抓取本文件，拿到这份脚本后：清掉旧缓存 jinju-v1、
 * 注销自己、刷新还开着的页面。之后根目录就干净了 —— 新的个人主页不注册任何 SW。
 *
 * 注意只删 jinju-v1：Cache Storage 是整个源共享的，无差别清空会把 /quotes/ 新建的
 * jinju-v2 一起误伤，害得金句 App 离线打不开。
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.delete('jinju-v1')
      .catch(function () { /* 本来就没有，无所谓 */ })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (clients) {
        clients.forEach(function (c) { c.navigate(c.url); });
      })
  );
});
