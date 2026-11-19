# 构建并部署到 Cloudflare Pages
# 用法：powershell -ExecutionPolicy Bypass -File tools/deploy.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '[1/2] 构建 web/' -ForegroundColor Cyan
node tools/build-web.js
if ($LASTEXITCODE -ne 0) { throw '构建失败，已停止部署' }

# 必须在 web 目录内部署，否则 Pages Functions 不会被编译
Write-Host '[2/2] 部署到 Cloudflare Pages' -ForegroundColor Cyan
Set-Location (Join-Path $root 'web')
wrangler pages deploy . --project-name junior-detective --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw '部署失败' }
