/* ==========================================================
   少年侦探社 · 离线缓存
   策略：
   - 页面导航：先走网络，失败时回退到缓存的 index.html
   - 静态资源：缓存优先，同时后台更新
   - /api/ 请求：完全交给网络，不缓存判分结果
   构建脚本会写入构建时间作为缓存代号，部署后自动换新缓存。
   ========================================================== */
/* 缓存代号由「版本号 + 构建时间」组成：
   - 生产构建把 1795156170398 换成时间戳，每次部署必定换新缓存；
   - 直接预览 prototype 时 1795156170398 保持字面量，版本号一变缓存名就变，
     不必等 SW 正文发生变化（正文不变时浏览器根本不会重新安装）。
   查询串 ?v=NN 仍然只用来绕过 HTTP 缓存，不参与更新判断。 */
const VER = new URL(self.location.href).searchParams.get('v') || '0';
const CACHE = 'junior-detective-' + VER + '-1795156170398';

/* 写入缓存时去掉查询串：否则 app.js 与 app.js?v=16 会变成两条，
   读到哪一条不确定，旧的那条会一直赢。 */
function cacheKey(req){
  const u = new URL(req.url);
  u.search = '';
  return u.toString();
}

const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'fx.js',
  'engine.js',
  'model.js',
  'account.js',
  'parent.js',
  'case.js',
  'app.js',
  'charts.js',
  'data.js',
  'data-1.js',
  'data-2.js',
  'data-3.js',
  'data-4.js',
  'data-5.js',
  'data-6.js',
  'data-7.js',
  'data-8.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => {
      /* 先给缓存，同时去网络取一次写回：下一次打开就是新文件，不用等 SW 更新 */
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(cacheKey(req), copy)).catch(() => {});
        }
        return res;
      }).catch(() => null);
      if (hit) { net.catch(() => {}); return hit; }
      return net.then(res => res || new Response('', {status: 504}));
    })
  );
});
