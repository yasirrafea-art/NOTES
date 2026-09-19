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
# ملاحظة أداء: كل الفحوص تقرأ نص الاستجابة الخام مباشرة بـ regex
# (ConvertFrom-Json في PS5.1 غير مستقر على هذه الاستجابات تحت EAP=Stop).
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

function Logout([string]$token) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  try {
    Invoke-RestMethod -Uri "$BaseUrl/auth/v1/logout" -Headers $h -Method Post -TimeoutSec 25 | Out-Null
    return $true
  } catch { return $false }
}

function TryRefresh([string]$refreshToken) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey"; 'Content-Type' = 'application/json' }
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/auth/v1/token?grant_type=refresh_token" -Headers $h -Method Post -Body (@{ refresh_token = $refreshToken } | ConvertTo-Json) -UseBasicParsing -TimeoutSec 25 -ErrorAction Stop
    return @{ ok = $true; status = [int]$r.StatusCode }
  } catch { return @{ ok = $false; status = -1 } }
}

# أدوات قراءة النص الخام مباشرة (بدون ConvertFrom-Json) — قيم الحقل المكرر كقائمة مسطحة
function JValues([string]$json, [string]$key) {
  $out = @()
  $pat = '"' + [regex]::Escape($key) + '"\s*:\s*"([^"]*)"'
  foreach ($m in [regex]::Matches("$json", $pat)) { $out += $m.Groups[1].Value }
  return $out
}
function JFirstValue([string]$json, [string]$key) {
  $pat = '"' + [regex]::Escape($key) + '"\s*:\s*"([^"]*)"'
  $m = [regex]::Match("$json", $pat)
  if ($m.Success) { return $m.Groups[1].Value }
  return ''
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
$refreshA = $ra.data.refresh_token
Write-Output "  A: $usernameA  (id مختصر: $($uidA.Substring(0,8))…)"
Write-Output "  B: $usernameB  (id مختصر: $($uidB.Substring(0,8))…)"

# مثل ما يفعله التطبيق: إنشاء الملف الشخصي فورًا بعد توفر user.id + الجلسة
$pA = TryRest 'POST' '/profiles' @{ id = $uidA; username = $usernameA; full_name = $usernameA } $ta
$pB = TryRest 'POST' '/profiles' @{ id = $uidB; username = $usernameB; full_name = $usernameB } $tb
Check 'إنشاء الملف الشخصي A (profiles) بعد user.id' ($pA.status -eq 201)
Check 'إنشاء الملف الشخصي B (profiles) بعد user.id' ($pB.status -eq 201)
$profAGet = TryRest 'GET' '/profiles?select=id' $null $ta
Check 'إنشاء الملف الشخصي A يظهر في ملفاته (GET)' (($profAGet.status -eq 200) -and (@(JValues $profAGet.content 'id') -contains "$uidA"))
$profBGet = TryRest 'GET' '/profiles?select=id' $null $tb
Check 'إنشاء الملف الشخصي B يظهر في ملفاته (GET)' (($profBGet.status -eq 200) -and (@(JValues $profBGet.content 'id') -contains "$uidB"))

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

# المعرّفات: يُسترد كل منها عبر فلتر النص (POST بلا رجوع سطر في PS)
$qAN = [Uri]::EscapeDataString("QA-A1-NOTE $ts"); $qAT = [Uri]::EscapeDataString("QA-A1-TASK $ts")
$qBN = [Uri]::EscapeDataString("QA-B1-NOTE $ts"); $qBT = [Uri]::EscapeDataString("QA-B1-TASK $ts")
$noteAId = JFirstValue (TryRest 'GET' "/entries?select=id&text=eq.$qAN" $null $ta).content 'id'
$taskAId = JFirstValue (TryRest 'GET' "/entries?select=id&text=eq.$qAT" $null $ta).content 'id'
$noteBId = JFirstValue (TryRest 'GET' "/entries?select=id&text=eq.$qBN" $null $tb).content 'id'
$taskBId = JFirstValue (TryRest 'GET' "/entries?select=id&text=eq.$qBT" $null $tb).content 'id'
Check 'استرجاع معرّفات السجلات المنشأة' ($noteAId -and $taskAId -and $noteBId -and $taskBId)

Write-Output ''
Write-Output '=== 4b) تسجيل الخروج ثم إعادة تسجيل الدخول ==='
$loggedOut = Logout $ta
Check 'خروج A من الجلسة (signout) نجح' $loggedOut
$revoke = TryRefresh $refreshA
Check 'توكن التحديث لـ A أُبطل بعد الخروج (refresh مرفوض)' (-not $revoke.ok)
$sep = SignIn $usernameA
Check 'إعادة دخول A بعد الخروج يعيد نفس الحساب' ($null -ne $sep -and $sep.user.id -eq $uidA)
if ($sep) { $ta = $sep.access_token }

Write-Output ''
Write-Output '=== 5) عزل القراءة ==='
$dA = TryRest 'GET' '/entries?select=text' $null $ta
$dB = TryRest 'GET' '/entries?select=text' $null $tb
$textsA = @(JValues $dA.content 'text') -join ';'
$textsB = @(JValues $dB.content 'text') -join ';'
Check 'B لا يرى بيانات A نهائيًا' (-not $textsB.Contains('QA-A1'))
Check 'A يرى بياناته فقط' ($textsA.Contains('QA-A1') -and -not $textsA.Contains('QA-B1'))

$direct = TryRest 'GET' "/entries?id=eq.$noteAId&select=id" $null $tb
Check 'B يطلب سجل A بالمعرف المباشر → لا يُرجع' ($direct.ok -and (@(JValues $direct.content 'id').Count -eq 0))

Write-Output ''
Write-Output '=== 6) منع التعديل/الحذف على بيانات الآخرين ==='
$patch = TryRest 'PATCH' "/entries?id=eq.$noteAId" @{ text = 'QA-HACKED-BY-B' } $tb
$stillOwn = TryRest 'GET' "/entries?id=eq.$noteAId&select=text" $null $ta
$stillTexts = @(JValues $stillOwn.content 'text') -join ';'
Check 'B يعدّل سجل A → سجل A لم يتغيّر' ($stillTexts -eq "QA-A1-NOTE $ts")
$del = TryRest 'DELETE' "/entries?id=eq.$noteAId" $null $tb
$afterDel = TryRest 'GET' "/entries?id=eq.$noteAId&select=id" $null $ta
Check 'B يحذف سجل A → سجل A ما زال موجودًا' ($afterDel.ok -and (@(JValues $afterDel.content 'id').Count -eq 1))

Write-Output ''
Write-Output '=== 7) محاولة إدراج باسم مالك آخر (tamper) ==='
$spoof = TryRest 'POST' '/entries' @{ kind = 'task'; text = "QA-SPOOF-BY-B $ts"; user_id = $uidA; priority = 'normal'; status = 'not_started'; description = 'spoof'; created_at = $t; updated_at = $t } $tb
$spoofOwner = ''
if ($spoof.ok) {
  $qS = [Uri]::EscapeDataString("QA-SPOOF-BY-B $ts")
  $own = TryRest 'GET' "/entries?select=user_id&text=eq.$qS" $null $tb
  $spoofOwner = (JValues $own.content 'user_id') -join ';'
}
Check 'حتى لو نجح الإدراج فملكيته لـ B وليست لـ A' (($null -ne $spoofOwner -and $spoofOwner -eq $uidB) -or -not ($spoof.ok -and $spoofOwner -eq ''))
$dA2 = TryRest 'GET' '/entries?select=text' $null $ta
Check 'محاولة B إنشاء سجل باسم A → لا يظهر في بيانات A إطلاقًا' (-not ((@(JValues $dA2.content 'text') -join ';').Contains('QA-SPOOF-BY-B')))

Write-Output ''
Write-Output '=== 8) تعديل/حذف بيانات النفس ==='
$patchOwn = TryRest 'PATCH' "/entries?id=eq.$noteAId" @{ text = "QA-A1-NOTE-EDITED $ts" } $ta
Check 'A يعدّل سجله → نجاح' ($patchOwn.ok)
$delOwnA = TryRest 'DELETE' "/entries?id=eq.$taskAId" $null $ta
Check 'A يحذف سجله → نجاح' ($delOwnA.ok)
$delOwnB = TryRest 'DELETE' "/entries?id=eq.$taskBId" $null $tb
Check 'B يحذف سجله → نجاح' ($delOwnB.ok)

Write-Output '=== 9) الملف الشخصي والاسم الظاهر ==='
$profA = TryRest 'GET' '/profiles?select=username' $null $ta
Check 'A يقرأ اسم مستخدمه من ملفه' (($profA.status -eq 200) -and ((@(JValues $profA.content 'username') -join ';').Contains($usernameA)))
$profOther = TryRest 'GET' "/profiles?id=neq.$uidA&select=id" $null $ta
Check 'A لا يقرأ ملفات آخرين' ($profOther.ok -and (@(JValues $profOther.content 'id').Count -eq 0))

Write-Output ''
Write-Output '====================================='
Write-Output "  النتيجة: PASS=$passCount  FAIL=$failCount"
Write-Output "  حسابات الاختبار: $usernameA / $usernameB (لا يُحذفان تلقائيًا؛ يمكن حذفهما من لوحة Auth)"
Write-Output '====================================='
if ($failCount -gt 0) { exit 1 } else { exit 0 }