# 少年侦探社 · 解题档案

面向小学高年级的数学「一步一步」练习应用。孩子是侦探，AI 搭档华生陪着一句一句往前推：每步只问一个小问题，答完立刻得到反馈，结案后留一份给家长看**过程**的档案，而不只是对错。

[在线体验](https://junior-detective.pages.dev) · [微信小程序版](#微信小程序版) · [MIT License](LICENSE)

![License](https://img.shields.io/github/license/lihaoyi1110/junior-detective)
![Demo](https://img.shields.io/badge/demo-junior--detective.pages.dev-123A2E)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-B98B3C)

## 为什么做这个

一道应用题的对错，往往说明不了孩子哪里没懂：可能是没读懂题，可能是看不出数量关系，也可能是列式对了但算错。只看到「×」，家长很难知道该补哪一环。

所以这里把每道题拆成若干步，逐步记录孩子是**自己走通**、**提示后走通**，还是**卡在某个概念上**，再按五个维度（审题、关系、建模、计算、迁移）汇总成可核对的观察，而不是一个笼统的分数。

## 它是怎么运转的

1. **出题**：每份案卷拆成 3–7 步，每步只问一个概念，不直接给答案。
2. **对话**：孩子作答后，模型判断属于 `正确 / 方向对但不具体 / 理解偏差 / 需要搭把手 / 答非所问`，先接住说对的部分，再只追缺的那半句；同一个卡点第二次起，支架再搭小半格。
3. **兜底**：没有配置模型、或模型连不上时，静默切换到内置规则判分，流程与界面完全一致。
4. **结案**：给出独立完成率与批注，可以「只重答卡住的 N 步」或「再练一遍这卷」，重审结果单独记录，不覆盖原分数。
5. **交接**：家长端按样本量给结论（样本不足时只说「观察中」），每个分数都能在练习记录里逐条核对，也可导出 CSV。

## 功能

**孩子端**

- 46 卷、244 个作答步骤，14 类题型，三～六年级，难度 L1–L3
- 三级台阶：便笺式线索 → 退半步 → 给结论，卡住不会直接给答案
- 语音作答：优先服务端识别，不支持时回落到浏览器识别；说错了可以改字
- 草稿纸：手指/手写笔直接画，按步骤保存，不进档案、不发判分
- 年级分组 + 筛选收起，已破案卷有标记；中途退出可续答
- 错题本（问 / 你答 / 华生说），可单步重练
- 夜间模式、离线打开、添加到主屏幕、档案导出/导入备份

**家长端**

- 本周回顾：练习次数、累计时长、无提示完成率、最常见卡点
- 五维诊断：分数 + 等级 + 行为描述 + 样本量，可展开该维度的原始作答
- 题型熟练度、近六次趋势、练习时间线
- 两条具体建议 + 推荐练的案卷；可复制文字版报告、导出逐步 CSV

## 目录结构

```
prototype/              网页版源码（无需构建即可运行）
  index.html            入口、主题初始化、Service Worker 注册
  app.js                路由、登录、首页、我的
  case.js               答题流程、语音、草稿纸、结案与重审
  engine.js             本地判分与诊断规则
  model.js              模型调用（失败自动回落到本地规则）
  parent.js             家长端报告、练习记录、CSV 导出
  data.js, data-1~8.js  题库分片
  styles.css            样式
  server.py             本地预览服务 + 模型/语音代理
cloudflare/             Cloudflare Pages Functions（/api/judge、/api/stt）
miniprogram/            微信小程序版页面与逻辑
cloudfunctions/judge/   小程序云函数（判分代理 + 模型配置）
tools/build-web.js      构建：prototype/ + cloudflare/ → web/
tools/deploy.ps1        构建并部署到 Cloudflare Pages
web/                    构建产物（静态站点 + functions/）
ui-mobile-checklist.md   手机端 UI 优化清单与功能核对
```

## 本地运行

需要 Python 3.9+。语音与 AI 是可选能力，不配置也能完整体验。

```bash
cd prototype
python server.py
```

打开 <http://127.0.0.1:8765/index.html>。

手机在同一局域网访问时，麦克风要求安全上下文，用 HTTPS 启动：

```powershell
$env:HTTPS='1'; python server.py
```

首次打开会提示证书不受信任，选择「继续访问」即可。

### 环境变量

在 `prototype/.env` 中配置（该文件已被 `.gitignore` 排除，不会提交）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `LLM_API_KEY` | 模型服务密钥，留空则使用本地规则 | 空 |
| `LLM_BASE_URL` | 兼容 OpenAI 的接口地址 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名 | `deepseek-chat` |
| `STT_API_KEY` | 语音识别服务密钥，留空则只用浏览器识别 | 空 |
| `STT_BASE_URL` | 语音服务地址 | `https://api.siliconflow.cn/v1` |
| `STT_MODEL` | 语音识别模型 | `FunAudioLLM/SenseVoiceSmall` |
| `PORT` | 本地端口 | `8765` |
| `HTTPS` | 设为 `1` 时同时接受 https 连接 | `0` |

> 密钥只保存在本机服务端或部署平台的环境变量里，前端代码拿不到，也不会写进仓库。

## 构建与部署

```powershell
powershell -ExecutionPolicy Bypass -File tools/deploy.ps1
```

脚本会先构建 `web/`，再进入该目录部署到 Cloudflare Pages。

手动执行时，务必在 `web` 目录内部署，否则 Pages Functions 不会被编译：

```powershell
node tools/build-web.js
cd web
wrangler pages deploy . --project-name junior-detective --commit-dirty=true
```

部署后在 Pages 项目的环境变量里补上 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`、`STT_API_KEY`、`STT_BASE_URL`、`STT_MODEL` 即可启用模型判分与语音识别。

## 微信小程序版

`miniprogram/` 是同一套题库与交互的小程序实现，用微信开发者工具导入仓库根目录即可（`project.config.json` 已指向 `miniprogram/` 与 `cloudfunctions/`）。

1. 开通云开发，创建环境。
2. 在云开发控制台新建集合 `model_config`（仅云函数可写），或给云函数配置环境变量 `DEEPSEEK_KEY`、`DEEPSEEK_BASE`、`DEEPSEEK_MODEL`。
3. 上传并部署 `cloudfunctions/judge`，在小程序「我的 → 模型设置」里填接口地址与 Key 后测试连接。

Key 存在云数据库（按 openid 隔离）或云函数环境变量中，客户端只能拿到掩码。

## 判分接口

网页版通过 Cloudflare Pages Functions 代理模型，密钥不进前端。

```
POST /api/judge
{
  "case":  { "title", "stem", "type", "level", "grade" },
  "step":  { "q", "probe", "expect", "keys", "index", "total", "confuse", "tag" },
  "next":  "下一步的问题",
  "history": [{ "who": "kid|ai", "text": "..." }],
  "attempt": 2,
  "answer": "孩子的原话"
}
→ { "verdict": "ok|partial|confuse|off|idk",
    "understanding": "...", "misconception": "...", "reply": "..." }
```

`GET /api/judge` 用于健康检查，返回 `{ ok, model, base }`；`GET /api/stt` 用于探测服务端语音识别是否可用。小程序版走同名云函数 `judge`。

## 数据与隐私

- 答题记录、家长报告都保存在浏览器 `localStorage`（小程序为本地缓存），不上传服务器。
- 只有当前这一步的作答文本会发送到你配置的模型服务用于生成反馈；不发送姓名等身份信息。
- 账号名仅用于在本机区分档案，支持导出 JSON 备份与导入合并。

## 已知限制

- 记录以本机为主，不自动跨设备同步；换设备需手动导入备份。
- 线上版模型只能由部署方配置，家长端不提供 Key 输入。
- Service Worker 只在 `https` 或 `localhost` 生效，首次访问仍需联网。
- 语音识别效果取决于所接入的识别服务，嘈杂环境建议改用键盘作答。

## 许可证

[MIT](LICENSE)
