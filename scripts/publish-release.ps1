$ErrorActionPreference = 'Stop'
# Publish the v1.0.3 GitHub release using the token stored in the local
# git credential manager. The token is never printed or written to disk.
$repo = '296711867/Amy-PPT'
$tag = 'v1.0.3'

$credInput = "url=https://github.com`n`n"
$cred = $credInput | git credential fill 2>$null
$token = ($cred | Select-String '^password=(.+)$').Matches[0].Groups[1].Value
if (-not $token) { throw 'no github token in credential store' }
$authHeader = "token $token"

$releaseBody = @'
Amy-PPT 1.0.3

## 更新内容

- **GLM-5.2 兼容**：思考模式流式分片解析修复，关闭软件崩溃修复
- **限流韧性**：限流自动退避重试（15s/30s），页面生成并发可配置（自动 / 逐页 / 并行），限流时自动降级为逐页
- **额度提示**：余额不足等计费错误秒级失败并提示充值，不再白等重试
- **模型验证提速**：API 验证改为流式，思考模型不再触发超时
- **大页面修复**：max_tokens 上限提升至 64K，思考模型不再把整页 HTML 写到一半截断
- **图片占位符模式**：新增显式"图片占位符"选项，生成带语义描述（画面主题 / 构图 / 氛围）的可替换占位块，无需生图模型
- **主题统一**：对话创作页、快速创建页、会话页全部面板 / 弹窗 / 检查器接入五套主题（含午夜黑）

## 安装

下载 `amy-ppt-1.0.3-setup.exe` 双击安装（Windows x64，NSIS 安装器，可自选目录）。
'@

# Check for an existing release on this tag (retry-safe publishing)
$existing = $null
try {
  $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$tag" `
    -Headers @{ Authorization = $authHeader; Accept = 'application/vnd.github+json' }
} catch {}

if ($existing) {
  Write-Output ("release already exists: id=" + $existing.id + " — updating name/body and asset")
  $releaseId = $existing.id
  $updPath = Join-Path $env:TEMP 'amy-release-payload.json'
  $upd = @{ name = 'Amy-PPT 1.0.3'; body = $releaseBody } | ConvertTo-Json
  [IO.File]::WriteAllText($updPath, $upd, (New-Object System.Text.UTF8Encoding($false)))
  Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/$repo/releases/$releaseId" -Headers @{ Authorization = $authHeader; Accept = 'application/vnd.github+json' } -InFile $updPath -ContentType 'application/json; charset=utf-8' | Out-Null
  Write-Output 'release title/body updated'
} else {
  $payload = @{
    tag_name = $tag
    name = 'Amy-PPT 1.0.3'
    body = $releaseBody
    draft = $false
    prerelease = $false
  } | ConvertTo-Json
  $payloadPath = Join-Path $env:TEMP 'amy-release-payload.json'
  [IO.File]::WriteAllText($payloadPath, $payload, (New-Object System.Text.UTF8Encoding($false)))
  $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/releases" `
    -Headers @{ Authorization = $authHeader; Accept = 'application/vnd.github+json' } `
    -InFile $payloadPath -ContentType 'application/json; charset=utf-8'
  $releaseId = $release.id
  Write-Output ("release created: id=" + $releaseId)
}

$asset = 'dist/amy-ppt-1.0.3-setup.exe'
$assetName = 'amy-ppt-1.0.3-setup.exe'
# delete a same-named asset if it exists (idempotent re-runs)
foreach ($a in (@(Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/$releaseId/assets" `
    -Headers @{ Authorization = $authHeader }))) {
  if ($a.name -eq $assetName) {
    Invoke-RestMethod -Method Delete -Uri $a.url -Headers @{ Authorization = $authHeader } | Out-Null
    Write-Output 'old asset deleted'
  }
}

$env:GH_TOKEN = $token
& curl.exe -sS -X POST `
  -H "Authorization: token $env:GH_TOKEN" `
  -H 'Content-Type: application/octet-stream' `
  --data-binary "@$asset" `
  "https://uploads.github.com/repos/$repo/releases/$releaseId/assets?name=$assetName" `
  -o "$env:TEMP\amy-asset-upload.json"
$uploaded = Get-Content "$env:TEMP\amy-asset-upload.json" -Raw | ConvertFrom-Json
if ($uploaded.browser_download_url) {
  Write-Output ('asset uploaded: ' + $uploaded.browser_download_url)
  Write-Output ('size: ' + [Math]::Round($uploaded.size / 1MB, 1) + ' MB')
} else {
  $raw = Get-Content "$env:TEMP\amy-asset-upload.json" -Raw
  Write-Output ('upload response: ' + $raw.Substring(0, [Math]::Min(400, $raw.Length)))
}
Remove-Item Env:GH_TOKEN
