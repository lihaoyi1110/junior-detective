/* ==========================================================
   题库 · 基础数据
   每个 step 都带「期望概念 / 常见混淆」两组语义槽位，
   判定器据此判断孩子懂到哪一步，而不是比对固定答案。
   ========================================================== */
window.CASES = window.CASES || [];

window.DIMS = [
  {key:'reading', name:'审题理解'},
  {key:'relation', name:'数量关系'},
  {key:'model',    name:'建模策略'},
  {key:'calc',     name:'计算执行'},
  {key:'transfer', name:'迁移应用'}
];

/* 给家长的正向替换句：不说“别怎样”，直接给可以怎么说 */
window.SAY = {
  '审题':'我们一起把题目读一遍，你觉得它在问什么？',
  '关系':'你能画一画，它们之间是什么关系吗？',
  '建模':'先不算答案，你觉得第一步该求什么？',
  '计算':'我们把这一步拆成两行，一起核对一下。',
  '迁移':'如果我把这个条件换掉，你觉得会怎么变？'
};

/* 逻辑思考类排在前面：周期、倒推、容斥、排列组合、统筹、找次品都属推理型应用题 */
window.TYPES = ['逻辑推理','周期','倒推','容斥','排列组合','统筹','找次品','行程','鸡兔同笼','归一','植树','工程','盈亏','年龄'];

/* 年级由低到高，首页筛选与分组都按这个顺序 */
window.GRADES = ['三年级','四年级','五年级','六年级'];

/* ---------- 本地档案存储 ----------
   记录按孩子分开存：同一台设备可以有多个档案，互不覆盖。 */
window.Store = {
  key:'detective_v3',

  /* 当前孩子由 Account 决定；账号脚本尚未加载时落到默认槽位 */
  id(){
    try{ return (window.Account && Account.activeId()) || 'k0'; }catch(e){ return 'k0'; }
  },
  slot(){ return this.key + '_' + this.id(); },
  read(k){
    let a = null;
    try{ a = JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ a = null; }
    return Array.isArray(a) ? a : null;
  },

  /* 没有记录就返回空数组：新用户看到的是空档案，不是编造的练习 */
  all(){
    const k = this.slot();
    let a = this.read(k);
    /* 旧版只有一份记录：第一次升级时并入当前孩子的档案 */
    if(!a){
      const legacy = this.read(this.key);
      if(legacy && legacy.length){
        a = legacy;
        localStorage.setItem(k, JSON.stringify(a));
        localStorage.removeItem(this.key);
      }else{
        a = [];
      }
    }
    /* 早期版本写入过演示数据，读到就丢掉，不参与任何统计 */
    return a.filter(s=>!s.demo);
  },
  save(a){ localStorage.setItem(this.slot(), JSON.stringify(a.slice(0,80))); },
  add(s){ const a=this.all(); a.unshift(s); this.save(a); },
  /* 清空记录时把未结案的续答存档一起清掉，避免只剩半卷进度 */
  clear(){
    localStorage.removeItem(this.slot());
    localStorage.removeItem(this.key + '_resume_' + this.id());
  }
};
