/* ==========================================================
   少年侦探社 · 离线缓存
   策略：
   - 页面导航：先走网络，失败时回退到缓存的 index.html
   - 静态资源：缓存优先 + 后台更新；同版本 SW 内的资源才互相匹配
   - /api/ 请求：完全交给网络，不缓存判分结果
   
   构建脚本会把 __BUILD__ 换成时间戳，每次部署必定换缓存代号。
   
   版本隔离：SW 缓存 key 带版本号，不同 ?v=NN 的资源互不相干，
   彻底杜绝「旧 SW 缓存的旧脚本 + 新 index.html 的新资源」版本混配。
   安装成功后主动 self.registration.update()，不等浏览器被动触发。
   ========================================================== */

/* SW 自己 URL 里的 ?v=NN —— 部署时一定和 index.html 同步 */
const VER = new URL(self.location.href).searchParams.get('v') || '0';
/* 缓存代号 = 版本号 + 构建时间戳 + 随机盐；每次部署换新 */
const BUILD = '__BUILD__';
const CACHE = 'junior-detective-v' + VER + '-' + BUILD;

/* fetch 超时：某个资源永久挂起就放弃，不要卡住整个启动 */
const FETCH_TIMEOUT = 15000;

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

function timeoutFetch(req){
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    fetch(req, { signal: ctrl.signal })
      .then(r => resolve(r))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(t));
  });
}

/* 给资源 URL 补上当前版本的 querystring，确保和 SW 自己的版本匹配
   —— 不同版本的 SW 各自管理自己版本的缓存，永不混配 */
function versionedUrl(path){
  const u = new URL(path, self.location.href);
  u.searchParams.set('v', VER);
  return u.toString();
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(ASSETS.map(a => {
        const url = versionedUrl(a);
        return timeoutFetch(url).then(res => {
          if (res && res.ok) return cache.put(url, res);
          return null;
        });
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      /* 主动触发浏览器去拉新版 SW，不等用户下次打开页面 */
      .then(() => { try { self.registration.update(); } catch(e){} })
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
      timeoutFetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req.url, copy)).catch(() => {});
            return res;
          }
          return caches.match(req);
        })
    );
    return;
  }

  /* 静态资源：只匹配当前版本的缓存条目，版本不匹配直接走网络
     —— ignoreSearch:false 让 ?v=32 和 ?v=33 变成两条独立缓存，永不再混配 */
  event.respondWith(
    caches.match(req, {ignoreSearch: false}).then(hit => {
      const net = timeoutFetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.url, copy)).catch(() => {});
          return res;
        }
        return hit || new Response('', {status: 504});
      });
      if (hit) return hit;
      return net;
    })
  );
});

/* 收到消息就主动更新 —— index.html 启动时会发一条触发 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'UPDATE_NOW') {
    try { self.registration.update(); } catch(e){}
  }
});
