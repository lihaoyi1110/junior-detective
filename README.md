# 少年侦探社 · 解题档案

面向小学高年级的数学「侦探」练习应用：孩子是侦探，AI 搭档华生陪着一句一句往前推。题目按步骤拆解，每一步只问一个小问题，答完立刻得到反馈，最终留档给家长看过程，而不只是看对错。

在线体验：<https://junior-detective.pages.dev>

## 特点

- **一步一步来**：46 卷、244 个作答步骤。每步只推进一个概念，不直接给答案。
- **会说就能答**：支持语音作答。手机浏览器用本机识别，不支持时自动走服务端识别。
- **能写就能想**：草稿纸可手指直接画，草稿不进档案。
- **卡点可重审**：结案后可以单独重走卡住的那几步，结果单独记录，不改原分数。
- **家长看过程**：五个维度（审题、关系、建模、计算、迁移）按样本量给出观察，附可逐条核对的练习记录与 CSV 导出。
- **无后端也能用**：没有配置模型时静默使用内置规则判分，界面与流程完全一致。
- **PWA**：可添加到主屏幕，离线可打开。

## 目录结构

```
prototype/            源码（直接可跑，无需构建）
  index.html          入口、主题初始化、Service Worker 注册
  app.js              路由、登录、首页、设置
  case.js             答题流程、语音、草稿纸、结案与重审
  engine.js           本地判分与诊断规则
  model.js            模型调用（失败自动回落到本地规则）
  parent.js           家长端报告、练习记录、CSV 导出
  data*.js            题库（8 个分片）
  styles.css          样式
  server.py           本地预览服务 + 模型/语音代理
cloudflare/           Cloudflare Pages Functions 源码
  judge.js            /api/judge
  stt.js              /api/stt
tools/build-web.js    构建：prototype/ + cloudflare/ → web/
tools/deploy.ps1      构建并部署到 Cloudflare Pages
web/                  构建产物（静态站点 + functions/）
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

脚本会先构建 `web/`，再进入该目录部署到 Cloudflare Pages。构建结果包含静态文件与 `functions/api/*`。

手动执行时，务必在 `web` 目录内部署，否则 Pages Functions 不会被编译：

```powershell
node tools/build-web.js
cd web
wrangler pages deploy . --project-name junior-detective --commit-dirty=true
```

首次部署后，在项目设置里添加 `LLM_API_KEY`、`STT_API_KEY` 等环境变量，接口即可生效。

## 数据与隐私

- 答题记录、家长报告全部保存在浏览器 `localStorage`，不上传服务器。
- 只有作答文本会发送到你配置的模型服务用于生成反馈；不发送姓名等身份信息。
- 账号名仅用于本机区分档案。

## 许可证

[MIT](LICENSE)
