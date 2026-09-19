# ============================================================
# دفتر العمل — تحقق آلي من نظام Username + عزل المستخدمين
# الشرط المسبق: تطبيق
#   supabase/migrations/002_multi_user_rls.sql
#   supabase/migrations/003_username_auth.sql
# في لوحة Supabase أولًا (SQL Editor → Run) ثم تشغيل السكربت.
#
# التشغيل (PowerShell 5.1+):
#   powershell -ExecutionPolicy Bypass -File scripts/verify_multi_user.ps1
#
# ماذا يختبر:
#   - إنشاء حسابين باسم مستخدم + رمز سري (بلا بريد)
#   - تفرد اسم المستخدم (ثانية بنفس الاسم مرفوضة/لا تُنشئ مستخدمًا جديدًا)
#   - تسجيل دخول / إعادة تسجيل دخول
#   - B لا يرى/يعدّل/يحذف بيانات A، والعكس
#   - محاولة إدراج باسم مالك آخر (tamper) لا تعبر العزل
#   - تعديل/حذف كل مستخدم لبياناته فقط + ملفه الشخصي فقط
# ============================================================

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BaseUrl = (Get-Content (Join-Path $PSScriptRoot '..\.env') | Where-Object { $_ -match '^VITE_SUPABASE_URL=' }) -replace '^VITE_SUPABASE_URL=', ''
$AnonKey = (Get-Content (Join-Path $PSScriptRoot '..\.env') | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' }) -replace '^VITE_SUPABASE_ANON_KEY=', ''
$BaseUrl = $BaseUrl.Trim(); $AnonKey = $AnonKey.Trim()
if (-not $BaseUrl -or -not $AnonKey) { Write-Output 'تعذر قراءة متغيرات .env'; exit 1 }

# نطاق مضاعف لتطابق تطبيقنا (auth.ts): username@workbook.local
$Domain = 'workbook.local'
$ts = Get-Date -Format 'Hmmss'
$usernameA = "qa.a.$ts"
$usernameB = "qa.b.$ts"
$pass = 'QaTestPass!2026'

$passCount = 0; $failCount = 0
function Check([string]$name, [bool]$cond) {
  if ($cond) { $script:passCount++; Write-Output "  [PASS] $name" }
  else { $script:failCount++; Write-Output "  [FAIL] $name" }
}

function PostAuth([string]$path, $body, [string]$token) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  try { return Invoke-RestMethod -Uri "$BaseUrl$path" -Headers $h -Method Post -Body ($body | ConvertTo-Json -Depth 6) -TimeoutSec 25 }
  catch { throw "PostAuth ${path}: $($_.Exception.Message)" }
}

function SignUp([string]$username) {
  try {
    $r = PostAuth '/auth/v1/signup' @{ email = "$username@$Domain"; password = $pass } $AnonKey
    return @{ ok = $true; data = $r; err = $null }
  } catch { return @{ ok = $false; data = $null; err = $_.Exception.Message } }
}

function SignIn([string]$username) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey"; 'Content-Type' = 'application/json' }
  try {
    return Invoke-RestMethod -Uri "$BaseUrl/auth/v1/token?grant_type=password" -Headers $h -Method Post -Body (@{ email = "$username@$Domain"; password = $pass } | ConvertTo-Json) -TimeoutSec 25
  } catch { return $null }
}

function TryRest([string]$method, [string]$path, $body, [string]$token) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  $json = if ($null -ne $body) { $body | ConvertTo-Json -Depth 6 } else { $null }
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/rest/v1$path" -Headers $h -Method $method -Body $json -UseBasicParsing -TimeoutSec 25 -ErrorAction Stop
    return @{ ok = ($r.StatusCode -lt 400); status = [int]$r.StatusCode; content = $r.Content }
  } catch {
    $status = -1
    $content = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
        $content = $sr.ReadToEnd()
      } catch { }
    }
    return @{ ok = ($status -ge 200 -and $status -lt 400); status = $status; content = $content }
  }
}

function ListRows([string]$table, [string]$select, [string]$token) {
  $rr = TryRest 'GET' "/$table?select=$select" $null $token
  if (-not $rr.ok) { return @() }
  try { return @(($rr.content | ConvertFrom-Json)) } catch { return @() }
}

function Logout([string]$token) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  try {
    Invoke-RestMethod -Uri "$BaseUrl/auth/v1/logout" -Headers $h -Method Post -TimeoutSec 25 | Out-Null
    return $true
  } catch { return $false }
}

Write-Output '=== 1) إنشاء حسابين (اسم مستخدم + رمز سري) ==='
$ra = SignUp $usernameA
if (-not $ra.data -or -not $ra.data.access_token) {
  Write-Output '  لا جلسة فورية لـ A — أحاول تسجيل الدخول مباشرة.'
  $ra = @{ ok = $true; data = (SignIn $usernameA); err = $null }
}
$rb = SignUp $usernameB
if (-not $rb.data -or -not $rb.data.access_token) {
  Write-Output '  لا جلسة فورية لـ B — أحاول تسجيل الدخول مباشرة.'
  $rb = @{ ok = $true; data = (SignIn $usernameB); err = $null }
}

if (-not $ra.data.access_token -or -not $rb.data.access_token) {
  Write-Output ''
  Write-Output '[STOP] لا يمكن إنشاء الجلسات تجريبيًا.'
  Write-Output '  الحل: في لوحة Supabase → Authentication → Providers → Email → أطفئ "Confirm email" ثم أعد التشغيل.'
  exit 2
}
$ta = $ra.data.access_token; $tb = $rb.data.access_token
$uidA = $ra.data.user.id; $uidB = $rb.data.user.id
Write-Output "  A: $usernameA  (id مختصر: $($uidA.Substring(0,8))…)"
Write-Output "  B: $usernameB  (id مختصر: $($uidB.Substring(0,8))…)"

Write-Output ''
Write-Output '=== 2) تفرد اسم المستخدم (التسجيل بنفس الاسم لا يكرر الحساب) ==='
$dup = SignUp $usernameA
$dupCreated = -not $dup.err -and $dup.data -and $dup.data.user -and $dup.data.user.id -ne $uidA
Check 'اسم مستخدم مكرر لا يُنشئ حسابًا جديدًا' (-not $dupCreated)

Write-Output ''
Write-Output '=== 3) إعادة تسجيل الدخول (جلسة جديدة) ==='
$again = SignIn $usernameA
Check 'تسجيل الدخول مجددًا يمنح حساب A نفسه' ($null -ne $again -and $again.user.id -eq $uidA)
if ($again) { $ta = $again.access_token }

Write-Output ''
Write-Output '=== 4) إنشاء بيانات أصلية لكل مستخدم ==='
$t = (Get-Date).ToUniversalTime().ToString('o')
$noteA = TryRest 'POST' '/entries' @{ kind = 'note'; text = "QA-A1-NOTE $ts"; priority = 'normal'; status = $null; project_id = $null; due_date = $null; description = 'test'; completed_at = $null; created_at = $t; updated_at = $t } $ta
$taskA = TryRest 'POST' '/entries' @{ kind = 'task'; text = "QA-A1-TASK $ts"; priority = 'normal'; status = 'not_started'; project_id = $null; due_date = $null; description = 'test'; completed_at = $null; created_at = $t; updated_at = $t } $ta
$noteB = TryRest 'POST' '/entries' @{ kind = 'note'; text = "QA-B1-NOTE $ts"; priority = 'normal'; status = $null; project_id = $null; due_date = $null; description = 'test'; completed_at = $null; created_at = $t; updated_at = $t } $tb
$taskB = TryRest 'POST' '/entries' @{ kind = 'task'; text = "QA-B1-TASK $ts"; priority = 'normal'; status = 'not_started'; project_id = $null; due_date = $null; description = 'test'; completed_at = $null; created_at = $t; updated_at = $t } $tb
Check 'A ينشئ مهمة + ملاحظة' ($noteA.ok -and $taskA.ok)
Check 'B ينشئ مهمة + ملاحظة' ($noteB.ok -and $taskB.ok)
$noteAId = if ($noteA.ok -and $noteA.content) { (($noteA.content | ConvertFrom-Json)).id } else { '' }
$noteBId = if ($noteB.ok -and $noteB.content) { (($noteB.content | ConvertFrom-Json)).id } else { '' }
$taskAId = if ($taskA.ok -and $taskA.content) { (($taskA.content | ConvertFrom-Json)).id } else { '' }
$taskBId = if ($taskB.ok -and $taskB.content) { (($taskB.content | ConvertFrom-Json)).id } else { '' }

Write-Output ''
Write-Output '=== 4b) تسجيل الخروج ثم إعادة تسجيل الدخول ==='
$loggedOut = Logout $ta
Check 'خروج A من الجلسة (signout) نجح' $loggedOut
$afterLogout = ListRows 'entries' 'id' $ta
Check 'جلسة A بعد الخروج لم تعد صالحة لقراءة البيانات' ($afterLogout.Count -eq 0)
$sep = SignIn $usernameA
Check 'إعادة دخول A بعد الخروج يعيد نفس الحساب' ($null -ne $sep -and $sep.user.id -eq $uidA)
if ($sep) { $ta = $sep.access_token }

Write-Output ''
Write-Output '=== 5) عزل القراءة ==='
$rowsB = ListRows 'entries' 'text' $tb
Check 'B لا يرى بيانات A نهائيًا' (-not ($rowsB.text -match 'QA-A1'))
$rowsA = ListRows 'entries' 'text' $ta
Check 'A يرى بياناته فقط' (($rowsA.text -match 'QA-A1') -and -not ($rowsA.text -match 'QA-B1'))

$direct = TryRest 'GET' "/entries?id=eq.$noteAId&select=id" $null $tb
Check 'B يطلب سجل A بالمعرف المباشر → لا يُرجع' ($direct.status -eq 200 -and ($direct.content.Trim().TrimStart('[').TrimEnd(']').Trim().Length -eq 0))

Write-Output ''
Write-Output '=== 6) منع التعديل/الحذف على بيانات الآخرين ==='
$patch = TryRest 'PATCH' "/entries?id=eq.$noteAId" @{ text = 'QA-HACKED-BY-B' } $tb
Check 'B يعدّل سجل A → مرفوض' (-not $patch.ok -and $patch.status -ge 400)
$del = TryRest 'DELETE' "/entries?id=eq.$noteAId" $null $tb
Check 'B يحذف سجل A → مرفوض' (-not $del.ok -and $del.status -ge 400)

Write-Output ''
Write-Output '=== 7) محاولة إدراج باسم مالك آخر (tamper) ==='
$spoof = TryRest 'POST' '/entries' @{ kind = 'task'; text = "QA-SPOOF-BY-B $ts"; user_id = $uidA; priority = 'normal'; status = 'not_started'; description = 'spoof'; created_at = $t; updated_at = $t } $tb
$rowsA2 = ListRows 'entries' 'text' $ta
Check 'محاولة B إنشاء سجل باسم A → لا يظهر في بيانات A إطلاقًا' (-not ($rowsA2.text -match 'QA-SPOOF-BY-B'))
$spoofId = ''
if ($spoof.ok -and $spoof.content) { try { $spoofId = ($spoof.content | ConvertFrom-Json).id } catch { } }
if ($spoofId) {
  $obj = (TryRest 'GET' "/entries?id=eq.$spoofId&select=user_id" $null $tb)
  Check 'حتى لو نجح الإدراج فملكيته لـ B (بفعل trigger)' ($obj.ok -and $obj.content -match $uidB)
}

Write-Output ''
Write-Output '=== 8) تعديل/حذف بيانات النفس ==='
$patchOwn = TryRest 'PATCH' "/entries?id=eq.${noteAId}" @{ text = "QA-A1-NOTE-EDITED $ts" } $ta
Check 'A يعدّل سجله → نجاح' ($patchOwn.ok)
$delOwnA = TryRest 'DELETE' "/entries?id=eq.${taskAId}" $null $ta
Check 'A يحذف سجله → نجاح' ($delOwnA.ok)
$delOwnB = TryRest 'DELETE' "/entries?id=eq.${taskBId}" $null $tb
Check 'B يحذف سجله → نجاح' ($delOwnB.ok)

Write-Output ''
Write-Output '=== 9) الملف الشخصي والاسم الظاهر ==='
$profA = ListRows 'profiles' 'username' $ta
Check 'A يقرأ ملفه الشخصي' ($profA.Count -ge 1 -and ($profA.username -match $usernameA))
$profOther = TryRest 'GET' "/profiles?id=neq.$uidA&select=id" $null $ta
Check 'A لا يقرأ ملفات آخرين' ($profOther.ok -and ($profOther.content.Trim().TrimStart('[').TrimEnd(']').Trim().Length -eq 0))

Write-Output ''
Write-Output '====================================='
Write-Output "  النتيجة: PASS=$passCount  FAIL=$failCount"
Write-Output "  حسابات الاختبار: $usernameA / $usernameB (لا يُحذفان تلقائيًا؛ يمكن حذفهما من لوحة Auth)"
Write-Output '====================================='
if ($failCount -gt 0) { exit 1 } else { exit 0 }