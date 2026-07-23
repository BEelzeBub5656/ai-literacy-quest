[CmdletBinding()]
param(
    [int]$ApiPort = 8010,
    [int]$MetroPort = 8081,
    [string]$ClientApiHost = '',
    [switch]$ClearCache
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSCommandPath
$apiDirectory = Join-Path $projectRoot 'apps\api'
$mobileDirectory = Join-Path $projectRoot 'apps\mobile'
$outputDirectory = Join-Path $projectRoot 'output'
$apiStdoutLog = Join-Path $outputDirectory 'dev-api.log'
$apiStderrLog = Join-Path $outputDirectory 'dev-api-error.log'
$apiProcess = $null

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Stop-ProcessTree {
    param([int]$TargetProcessId)
    $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ParentProcessId -eq $TargetProcessId }
    foreach ($child in $children) {
        Stop-ProcessTree -TargetProcessId $child.ProcessId
    }
    Stop-Process -Id $TargetProcessId -Force -ErrorAction SilentlyContinue
}

# 清理占用指定监听端口的进程（无条件执行）
function Clear-Port {
    param(
        [int]$Port,
        [string]$ServiceName
    )
    $owners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pidVal in $owners) {
        if (-not $pidVal) { continue }
        Write-Host "  释放被占用的 $ServiceName 端口 $Port（进程 $pidVal）..." -ForegroundColor Yellow
        Stop-ProcessTree -TargetProcessId $pidVal
    }
}

# 按命令行特征清理残留进程（用于端口还没起来但进程已残留的情况）
function Stop-ByCommandLine {
    param(
        [string]$Pattern,
        [string]$ServiceName
    )
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern }
    foreach ($p in $procs) {
        Write-Host "  终止残留 $ServiceName 进程 $($p.ProcessId)..." -ForegroundColor Yellow
        Stop-ProcessTree -TargetProcessId $p.ProcessId
    }
}

function Get-RequiredCommand {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "缺少命令 '$Name'，请先安装并将其加入 PATH。"
    }
    return $command.Source
}

function Wait-ForApi {
    param(
        [string]$Url,
        [System.Diagnostics.Process]$Process,
        [int]$TimeoutSeconds = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) {
            throw "后端提前退出。请查看 $apiStderrLog"
        }
        $webClient = New-Object System.Net.WebClient
        $webClient.Proxy = $null
        try {
            $webClient.DownloadString($Url) | Out-Null
            return
        }
        catch {
            Start-Sleep -Milliseconds 350
        }
        finally {
            $webClient.Dispose()
        }
    }
    throw "后端在 $TimeoutSeconds 秒内未通过健康检查。请查看 $apiStderrLog"
}

function Get-PrimaryIpv4Address {
    try {
        $route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
            Where-Object { $_.NextHop -ne '0.0.0.0' } |
            Sort-Object RouteMetric, InterfaceMetric |
            Select-Object -First 1
        if ($route) {
            $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop |
                Where-Object { $_.IPAddress -notlike '169.254.*' } |
                Select-Object -First 1 -ExpandProperty IPAddress
            if ($address) {
                return $address
            }
        }
    }
    catch {
        # 无可用局域网地址时回退到 localhost。
    }
    return 'localhost'
}

function Get-ConnectedAndroidTarget {
    param([string]$AdbPath)
    if (-not $AdbPath) {
        return $null
    }
    $lines = & $AdbPath devices -l 2>$null
    return $lines |
        Where-Object { $_ -match '^\S+\s+device\b' } |
        Select-Object -First 1
}

# ---------- 前置检查 ----------
if (-not (Test-Path -LiteralPath $apiDirectory -PathType Container)) {
    throw "找不到后端目录：$apiDirectory"
}
if (-not (Test-Path -LiteralPath $mobileDirectory -PathType Container)) {
    throw "找不到移动端目录：$mobileDirectory"
}

$uvPath = Get-RequiredCommand -Name 'uv'
$npxPath = Get-RequiredCommand -Name 'npx.cmd'
$npmPath = Get-RequiredCommand -Name 'npm.cmd'
$adbCommand = Get-Command 'adb.exe' -ErrorAction SilentlyContinue
$adbPath = if ($adbCommand) { $adbCommand.Source } else { $null }
$androidTarget = Get-ConnectedAndroidTarget -AdbPath $adbPath

Write-Host '========================================' -ForegroundColor DarkCyan
Write-Host '  知芽校园 - 一键开发环境' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor DarkCyan

# ---------- 1. 先清理残留进程与占用端口 ----------
Write-Step '清理残留进程与占用端口'
Clear-Port -Port $ApiPort -ServiceName 'FastAPI'
Clear-Port -Port $MetroPort -ServiceName 'Expo/Metro'
Clear-Port -Port 19000 -ServiceName 'Expo'
Clear-Port -Port 19001 -ServiceName 'Expo'
Clear-Port -Port 19002 -ServiceName 'Expo'
Stop-ByCommandLine -Pattern 'campus_ai\.main:app' -ServiceName 'FastAPI'
Stop-ByCommandLine -Pattern 'apps[\\/]mobile.*expo|expo.*apps[\\/]mobile' -ServiceName 'Expo'
Start-Sleep -Milliseconds 600

# ---------- 2. 依赖安装（首次） ----------
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $mobileDirectory 'node_modules') -PathType Container)) {
    Write-Step '首次运行，安装移动端依赖'
    Push-Location $mobileDirectory
    try {
        & $npmPath install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install 失败，退出码：$LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

try {
    # ---------- 3. 同步后端虚拟环境 ----------
    Write-Step '同步 FastAPI 虚拟环境'
    Push-Location $apiDirectory
    try {
        & $uvPath sync --quiet
        if ($LASTEXITCODE -ne 0) {
            throw "uv sync 失败，退出码：$LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    # ---------- 4. 启动后端（监听 0.0.0.0，供手机访问） ----------
    Write-Step "启动 FastAPI（端口 $ApiPort）"
    $apiArguments = @(
        'run', 'python', '-m', 'uvicorn',
        'campus_ai.main:app',
        '--host', '0.0.0.0',
        '--port', $ApiPort,
        '--reload'
    )
    $apiProcess = Start-Process `
        -FilePath $uvPath `
        -ArgumentList $apiArguments `
        -WorkingDirectory $apiDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $apiStdoutLog `
        -RedirectStandardError $apiStderrLog `
        -PassThru

    $healthUrl = "http://127.0.0.1:$ApiPort/api/v1/ai/status"
    Wait-ForApi -Url $healthUrl -Process $apiProcess
    Write-Host "后端已就绪：$healthUrl" -ForegroundColor Green

    # ---------- 5. 计算手机可连的后端地址 ----------
    if (-not $ClientApiHost) {
        if ($androidTarget -and $androidTarget -match '^emulator-') {
            $ClientApiHost = '10.0.2.2'
        }
        else {
            $ClientApiHost = Get-PrimaryIpv4Address
        }
    }
    $env:EXPO_PUBLIC_API_BASE_URL = "http://${ClientApiHost}:$ApiPort/api/v1"
    Write-Host "移动端 API：$env:EXPO_PUBLIC_API_BASE_URL" -ForegroundColor Green
    Write-Host "API 文档：http://localhost:$ApiPort/docs" -ForegroundColor DarkGray
    Write-Host "后端日志：$apiStdoutLog" -ForegroundColor DarkGray

    # ---------- 6. 启动 Expo / Metro ----------
    Write-Step "启动 Expo/Metro（端口 $MetroPort）"
    $expoArguments = @('expo', 'start', '--port', $MetroPort)
    if ($ClearCache) {
        $expoArguments += '--clear'
    }
    if ($androidTarget) {
        Write-Host "检测到 Android 设备：$androidTarget" -ForegroundColor Green
        $expoArguments += '--android'
    }
    else {
        Write-Host '未检测到 Android 设备，将只启动 Metro；连接模拟器后按 a。' -ForegroundColor Yellow
    }

    Write-Host '按 Ctrl+C 可同时关闭 Metro 和后端。' -ForegroundColor Yellow
    Push-Location $mobileDirectory
    try {
        & $npxPath @expoArguments
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130) {
            throw "Expo 退出，退出码：$LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($apiProcess -and -not $apiProcess.HasExited) {
        Write-Host "`n正在关闭后端..." -ForegroundColor Yellow
        Stop-ProcessTree -TargetProcessId $apiProcess.Id
    }
    Remove-Item Env:EXPO_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
    Write-Host '开发服务已全部关闭。' -ForegroundColor Green
}
