$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ZhiYa Campus - Dev Environment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Starting FastAPI backend (port 8010)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\api'; uv run uvicorn campus_ai.main:app --host 0.0.0.0 --port 8010"

Write-Host "[2/2] Starting Expo..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\apps\mobile'; npx expo start"

Write-Host ""
Write-Host "Both windows opened." -ForegroundColor Green
Write-Host "  API Docs: http://localhost:8010/docs" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close this window"
