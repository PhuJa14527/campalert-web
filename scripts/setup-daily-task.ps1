# ตั้งให้ Windows รัน "ดึงข้อมูล + deploy" ให้เองวันละครั้ง
# รันด้วย: powershell -ExecutionPolicy Bypass -File scripts\setup-daily-task.ps1
# เอาเวลาอื่น: powershell -ExecutionPolicy Bypass -File scripts\setup-daily-task.ps1 -Time "07:15"
# ยกเลิก: Unregister-ScheduledTask -TaskName "CampAlert daily refresh" -Confirm:$false

param([string]$Time = "06:30")

$ErrorActionPreference = "Stop"
$taskName = "CampAlert daily refresh"
$refreshScript = Join-Path $PSScriptRoot "daily-refresh.ps1"

if (-not (Test-Path $refreshScript)) {
  throw "ไม่พบไฟล์ $refreshScript"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$refreshScript`"" `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "ดึงข้อมูล CAMPHUB ใหม่แล้ว push ให้ Vercel deploy เว็บค่ายไหนดี (วันละครั้ง)" `
  -Force | Out-Null

Write-Host ("ตั้งเวลาแล้ว: " + $taskName + " ทุกวัน " + $Time)
Write-Host ("ดูสถานะ: Get-ScheduledTask -TaskName '" + $taskName + "'")
Write-Host ("ลองรันทันที: Start-ScheduledTask -TaskName '" + $taskName + "'")
Write-Host ("ยกเลิก: Unregister-ScheduledTask -TaskName '" + $taskName + "' -Confirm:" + '$false')
