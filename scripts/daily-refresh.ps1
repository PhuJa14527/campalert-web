# รีเฟรชข้อมูล CAMPHUB วันละครั้ง แล้ว deploy ขึ้น Vercel
# ใช้กับ Windows Task Scheduler (ตั้งเวลาด้วย scripts/setup-daily-task.ps1)
#
# ทำไมต้องมี: ข้อมูลบนเว็บเป็นไฟล์ data/camps.json ที่ถูกฝังตอน build
# ถ้าไม่ build ใหม่ หน้าเว็บก็ยังเป็นข้อมูลรอบเดิม

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir "logs") | Out-Null

function Write-RefreshLog($message) {
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] $message" |
    Out-File -Append -Encoding utf8 (Join-Path $ProjectDir "logs\refresh.log")
}

Write-RefreshLog "เริ่มดึงข้อมูล CAMPHUB"
# ให้ cmd เป็นคนต่อท้าย log เพื่อไม่ให้ PowerShell แปลง encoding ของ output เป็น UTF-16
cmd /c "node scripts\fetch-camphub.mjs >> logs\refresh.log 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-RefreshLog "ดึงข้อมูลไม่สำเร็จ (exit $LASTEXITCODE) หยุดแค่นี้ ไม่ deploy"
  exit 1
}

Write-RefreshLog "ดึงข้อมูลเสร็จ เริ่ม deploy"
cmd /c "npx --yes vercel@latest --prod --yes >> logs\refresh.log 2>&1"
$code = $LASTEXITCODE
Write-RefreshLog "จบรอบ (deploy exit $code)"
exit $code
