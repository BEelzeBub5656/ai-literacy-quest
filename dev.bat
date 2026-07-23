@echo off
chcp 65001 >nul
title 知芽校园 - 开发环境

echo ============================================
echo   知芽校园 - AI 通识教育 App
echo   正在启动后端 + 移动端...
echo ============================================
echo.

set ROOT=%~dp0

echo [1/2] 启动 FastAPI 后端 (端口 8010)...
start "知芽-后端" cmd /k "cd /d %ROOT%apps\api && uv run uvicorn campus_ai.main:app --host 127.0.0.1 --port 8010"

echo [2/2] 启动 Expo 移动端...
start "知芽-Expo" cmd /k "cd /d %ROOT%apps\mobile && npx expo start"

echo.
echo 两个窗口已打开。
echo   后端 API 文档: http://localhost:8010/docs
echo   Expo 控制台: 在 Expo 窗口中查看
echo.
echo 关闭本窗口即可。
pause
