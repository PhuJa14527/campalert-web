# รีเฟรชข้อมูล CAMPHUB วันละครั้ง แล้ว push ขึ้น GitHub เพื่อให้ Vercel deploy
# ใช้กับ Windows Task Scheduler (ตั้งเวลาด้วย scripts/setup-daily-task.ps1)
#
# ทำไมต้องมี: ข้อมูลบนเว็บเป็นไฟล์ data/camps.json ที่ถูกฝังตอน build
# ถ้าไม่ build ใหม่ หน้าเว็บก็ยังเป็นข้อมูลรอบเดิม
#
# ทำไมต้องรันในเครื่อง ไม่ใช่ GitHub Actions:
# CAMPHUB ใช้ Cloudflare แล้วตอบ 403 "Just a moment..." กับ IP ของดาต้าเซ็นเตอร์
# ทดสอบจาก GitHub Actions แล้วได้ 403 ทุก user agent และจาก Vercel function ก็ได้ 403
# มีแต่เน็ตบ้าน (IP ของผู้ใช้จริง) ที่เข้าได้ จึงต้องดึงจากเครื่องนี้

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

$LogFile = Join-Path $ProjectDir "logs\refresh.log"
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir "logs") | Out-Null

function Write-RefreshLog($message) {
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm')] $message" |
    Out-File -Append -Encoding utf8 $LogFile
}

Write-RefreshLog "เริ่มดึงข้อมูล CAMPHUB"
# ให้ cmd เป็นคนต่อท้าย log เพื่อไม่ให้ PowerShell แปลง encoding ของ output เป็น UTF-16
cmd /c "node scripts\fetch-camphub.mjs >> logs\refresh.log 2>&1"
$fetchCode = $LASTEXITCODE

if ($fetchCode -eq 2) {
  # exit 2 = ตัวกันข้อมูลแย่ทับของดีทำงาน ไฟล์เดิมยังอยู่ครบ ไม่ต้องทำอะไรต่อ
  Write-RefreshLog "รอบนี้ได้ค่ายน้อยผิดปกติ ตัวกันข้อมูลเสียทำงาน จึงข้ามรอบนี้"
  exit 0
}
if ($fetchCode -ne 0) {
  Write-RefreshLog "ดึงข้อมูลไม่สำเร็จ (exit $fetchCode) หยุดแค่นี้ ไม่ push"
  exit 1
}

# commit เฉพาะไฟล์ข้อมูล ไม่แตะไฟล์อื่นที่อาจแก้ค้างไว้
git add data/camps.json *> $null
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-RefreshLog "ข้อมูลเท่าเดิม ไม่มีอะไรต้อง push"
  exit 0
}

$today = Get-Date -Format "yyyy-MM-dd"
$commitOut = git -c user.name="CampAlert" -c user.email="campalert@local" commit -m "รีเฟรชข้อมูล CAMPHUB $today" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-RefreshLog "commit ไม่สำเร็จ หยุดแค่นี้"
  Write-RefreshLog ($commitOut | Out-String)
  exit 1
}

# ถ้าระหว่างนั้นมี commit ใหม่บน GitHub ให้ rebase ต่อท้ายก่อน push
$pullOut = git pull --rebase origin master 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-RefreshLog "pull --rebase ไม่สำเร็จ (อาจมีไฟล์แก้อื่นค้างอยู่) ต้องแก้ด้วยมือ"
  Write-RefreshLog ($pullOut | Out-String)
  exit 1
}

$pushOut = git push origin master 2>&1
$pushCode = $LASTEXITCODE
if ($pushCode -eq 0) {
  Write-RefreshLog "push แล้ว Vercel จะ build และ deploy ให้เอง"
} else {
  Write-RefreshLog "push ไม่สำเร็จ (exit $pushCode)"
  Write-RefreshLog ($pushOut | Out-String)
}
Write-RefreshLog "จบรอบ (push exit $pushCode)"
exit $pushCode
