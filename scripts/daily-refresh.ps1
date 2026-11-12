# รีเฟรชข้อมูล CAMPHUB วันละครั้ง แล้ว deploy ขึ้น Vercel
# ใช้กับ Windows Task Scheduler (ตั้งเวลาด้วย scripts/setup-daily-task.ps1)
#
# ทำไมต้องมี: ข้อมูลบนเว็บเป็นไฟล์ data/camps.json ที่ถูกฝังตอน build
# ถ้าไม่ build ใหม่ หน้าเว็บก็ยังเป็นข้อมูลรอบเดิม

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$logDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "refresh.log"

function Write-RefreshLog($message) {
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] $message" | Out-File -Append -Encoding utf8 $log
}

Write-RefreshLog "เริ่มดึงข้อมูล CAMPHUB"
node scripts/fetch-camphub.mjs *>> $log
if ($LASTEXITCODE -ne 0) {
  Write-RefreshLog "ดึงข้อมูลไม่สำเร็จ (exit $LASTEXITCODE) หยุดแค่นี้ ไม่ deploy"
  exit 1
}

Write-RefreshLog "ดึงข้อมูลเสร็จ เริ่ม deploy"
npx --yes vercel@latest --prod --yes *>> $log
$code = $LASTEXITCODE
Write-RefreshLog "จบรอบ (deploy exit $code)"
exit $code
