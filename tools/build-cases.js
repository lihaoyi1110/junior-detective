/* ==========================================================
   把 prototype/ 的题库脚本转成小程序可 require 的模块
   用法：node tools/build-cases.js
   输出：miniprogram/model/cases.js
   ========================================================== */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const proto = path.join(root, 'prototype');
const outDir = path.join(root, 'miniprogram', 'model');
const outFile = path.join(outDir, 'cases.js');

/* 题库脚本挂的是 window.CASES / window.DIMS 等，这里用一个假 window 接住 */
global.window = global;
global.CASES = [];

['data.js', 'data-1.js', 'data-2.js', 'data-3.js', 'data-4.js',
 'data-5.js', 'data-6.js', 'data-7.js', 'data-8.js'].forEach(f => {
  require(path.join(proto, f));
});

const CASES = global.CASES;
const DIMS = global.DIMS;
const TYPES = global.TYPES;
const GRADES = global.GRADES;
const SAY = global.SAY;

if (!Array.isArray(CASES) || !CASES.length) throw new Error('没有读到题库');
if (!Array.isArray(DIMS) || DIMS.length !== 5) throw new Error('DIMS 结构不对');

const steps = CASES.reduce((n, c) => n + (c.steps || []).length, 0);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const body = '/* 由 tools/build-cases.js 自动生成，请勿手改。源文件：prototype/data*.js */\n'
  + 'module.exports = ' + JSON.stringify({ CASES, DIMS, TYPES, GRADES, SAY }) + ';\n';
fs.writeFileSync(outFile, body, 'utf8');

/* ---------- 自检：题型、年级、维度分布 ---------- */
const byType = {}, byGrade = {}, byDim = {};
CASES.forEach(c => {
  byType[c.type] = (byType[c.type] || 0) + 1;
  byGrade[c.grade] = (byGrade[c.grade] || 0) + 1;
  (c.steps || []).forEach(s => { byDim[s.dim] = (byDim[s.dim] || 0) + 1; });
});

const single = Object.keys(byType).filter(t => byType[t] < 3);
console.log('题库：' + CASES.length + ' 卷 · ' + steps + ' 个作答步骤');
console.log('题型：' + Object.keys(byType).length + ' 类 ' + JSON.stringify(byType));
console.log('年级：' + JSON.stringify(byGrade));
console.log('维度：' + JSON.stringify(byDim));
console.log(single.length ? '不足 3 卷的题型：' + single.join('、') : '每个题型均不少于 3 卷');
console.log('输出：' + outFile);
