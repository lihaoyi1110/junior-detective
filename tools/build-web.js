/* ==========================================================
   生成可部署的静态站点：prototype/ → web/
   只拷贝浏览器需要的文件，server.py / .env / __pycache__ 一律不带。
   同时把 cloudflare/judge.js 放到 Pages Functions 的约定路径。
   用法：node tools/build-web.js
   ========================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'prototype');
const OUT = path.join(ROOT, 'web');

const FILES = [
  'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'fx.js', 'engine.js', 'model.js', 'account.js', 'parent.js', 'case.js', 'app.js', 'charts.js',
  'data.js', 'data-1.js', 'data-2.js', 'data-3.js', 'data-4.js',
  'data-5.js', 'data-6.js', 'data-7.js', 'data-8.js',
  'sw.js'
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let bytes = 0;
FILES.forEach(name => {
  const from = path.join(SRC, name);
  if (!fs.existsSync(from)) throw new Error('缺少源文件：' + name);
  fs.copyFileSync(from, path.join(OUT, name));
  bytes += fs.statSync(from).size;
});

const fnDir = path.join(OUT, 'functions', 'api');
fs.mkdirSync(fnDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'cloudflare', 'judge.js'), path.join(fnDir, 'judge.js'));
fs.copyFileSync(path.join(ROOT, 'cloudflare', 'stt.js'), path.join(fnDir, 'stt.js'));

/* Service Worker 的缓存名带上构建时间：每次部署自动换新缓存，避免旧文件残留 */
const swPath = path.join(OUT, 'sw.js');
fs.writeFileSync(swPath,
  fs.readFileSync(swPath, 'utf8').replace(/__BUILD__/g, String(Date.now())), 'utf8');

/* 禁止把源文件、配置当成静态资源读出来 */
fs.writeFileSync(path.join(OUT, '_headers'), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '',
  '/sw.js',
  '  Cache-Control: no-cache',
  '',
  '/manifest.webmanifest',
  '  Content-Type: application/manifest+json',
  ''
].join('\n'), 'utf8');

console.log('已生成 ' + path.relative(ROOT, OUT) + '\\');
console.log('  静态文件 ' + FILES.length + ' 个，' + (bytes / 1024).toFixed(0) + ' KB');
console.log('  函数 web/functions/api/judge.js');
console.log('  函数 web/functions/api/stt.js');
console.log('\n部署：npx wrangler pages deploy web --project-name junior-detective');
