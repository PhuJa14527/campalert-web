# ตั้งให้ Windows รัน "ดึงข้อมูล + deploy" ให้เอง
# รันด้วย: powershell -ExecutionPolicy Bypass -File scripts\setup-daily-task.ps1
# เอาเวลาอื่น: powershell -ExecutionPolicy Bypass -File scripts\setup-daily-task.ps1 -Time "07:15"
# ยกเลิก: Unregister-ScheduledTask -TaskName "CampAlert daily refresh" -Confirm:$false
#
# ทำไมต้องมีหลายรอบ: เครื่องนี้เป็นแล็ปท็อปที่ปิด/พักหน้าจอบ่อย
# ถ้าตั้งไว้รอบเดียวตอนเช้าแล้วเครื่องปิดอยู่ รอบนั้นก็ไม่ได้ทำอะไร
# เลยให้รันตอนล็อกอินด้วย (ช้า 2 นาทีให้เน็ตพร้อม) และรันซ้ำทุก 8 ชั่วโมงระหว่างเปิดเครื่อง
# ถ้าพลาดรอบไหน Windows จะชดเชยให้เมื่อเครื่องกลับมา (StartWhenAvailable)

param(
  [string]$Time = "06:30",
  [int]$EveryHours = 8
)

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

# รอบหลัก: เริ่มที่เวลาที่ตั้ง แล้ววนซ้ำทุกกี่ชั่วโมงก็ได้ระหว่างเครื่องเปิด
$repeat = New-ScheduledTaskTrigger `
  -Once `
  -At $Time `
  -RepetitionInterval (New-TimeSpan -Hours $EveryHours) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

# รอบเสริม: ทุกครั้งที่ล็อกอิน ช้า 2 นาทีให้ Wi-Fi ต่อเสร็จก่อน
$logon = New-ScheduledTaskTrigger -AtLogOn
$logon.Delay = "PT2M"

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger @($repeat, $logon) `
  -Settings $settings `
  -Description "ดึงข้อมูล CAMPHUB ใหม่แล้ว push ให้ Vercel deploy เว็บค่ายไหนดี (ตอนล็อกอิน + ทุก $EveryHours ชั่วโมง)" `
  -Force | Out-Null

Write-Host ("ตั้งเวลาแล้ว: " + $taskName + " เริ่ม " + $Time + " แล้วซ้ำทุก " + $EveryHours + " ชั่วโมง และทุกครั้งที่ล็อกอิน")
Write-Host ("ดูสถานะ: Get-ScheduledTask -TaskName '" + $taskName + "'")
Write-Host ("ลองรันทันที: Start-ScheduledTask -TaskName '" + $taskName + "'")
Write-Host ("ยกเลิก: Unregister-ScheduledTask -TaskName '" + $taskName + "' -Confirm:" + '$false')
