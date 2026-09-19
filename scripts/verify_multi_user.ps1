﻿# ============================================================
# دفتر العمل — تحقق آلي من عزل المستخدمين (Multi-User RLS)
# الشرط المسبق: تطبيق supabase/migrations/002_multi_user_rls.sql
# في لوحة Supabase أولًا (SQL Editor → Run).
#
# التشغيل (PowerShell 5.1+):
#   powershell -ExecutionPolicy Bypass -File scripts/verify_multi_user.ps1
#
# ماذا يختبر:
#   - إنشاء حساب مستخدم A ومستخدم B (أو تسجيل الدخول إن وُجدا)
#   - إنشاء ملاحظة ومهمة لكل منهما
#   - B لا يرى بيانات A، و A لا يرى بيانات B
#   - محاولات B لقراءة/تعديل/حذف بيانات A مرفوضة
#   - وإدراج باسم مستخدم آخر (tamper) لا ينجح في عبور العزل
#   - تعديل/حذف كل مستخدم لبياناته فقط
#   - قراءة ملفه الشخصي فقط
#
# الانتباه: لا حاجة لفتح حساب جدّي — يُنشأ حسابان تجريبيان
# (لا يُحذفان تلقائيًا؛ يمكن حذفهما لاحقًا من لوحة Auth إن أردت).
# ============================================================

$ErrorActionPreference = 'Stop'

$env = @{}
Get-Content (Join-Path $PSScriptRoot '..\.env') | ForEach-Object {
  if ($_ -match '^([A-Za-z_]+)=') {
    $env[$matches[1]] = ($_ -replace "^$([regex]::Escape($matches[1]))=", '').Trim()
  }
}

$BaseUrl = (Get-Content (Join-Path $PSScriptRoot '..\.env') | Where-Object { $_ -match '^VITE_SUPABASE_URL=' }) -replace '^VITE_SUPABASE_URL=', ''
$AnonKey = (Get-Content (Join-Path $PSScriptRoot '..\.env') | Where-Object { $_ -match '^VITE_SUPABASE_ANON_KEY=' }) -replace '^VITE_SUPABASE_ANON_KEY=', ''
if (-not $BaseUrl.Trim() -or -not $AnonKey.Trim()) { Write-Output 'تعذر قراءة متغيرات .env'; exit 1 }
$BaseUrl = $BaseUrl.Trim(); $AnonKey = $AnonKey.Trim()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ts = Get-Date -Format 'Hmmss'
$emailA = "qa.$ts.a@mudhakkira.test"
$emailB = "qa.$ts.b@mudhakkira.test"
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

function SignUp([string]$email) {
  try {
    $r = PostAuth '/auth/v1/signup' @{ email = $email; password = $pass } $AnonKey
    return $r
  } catch { return $null }
}

function SignIn([string]$email) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey"; 'Content-Type' = 'application/json' }
  try {
    return Invoke-RestMethod -Uri "$BaseUrl/auth/v1/token?grant_type=password" -Headers $h -Method Post -Body (@{ email = $email; password = $pass } | ConvertTo-Json) -TimeoutSec 25
  } catch { return $null }
}

function TryRest([string]$method, [string]$path, $body, [string]$token) {
  $h = @{ apikey = $AnonKey; Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  $json = if ($null -ne $body) { $body | ConvertTo-Json -Depth 6 } else { $null }
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/rest/v1$path" -Headers $h -Method $method -Body $json -UseBasicParsing -TimeoutSec 25 -SkipHttpErrorCheck -ErrorAction Stop
    return @{ ok = ($r.StatusCode -lt 400); status = $r.StatusCode; content = $r.Content }
  } catch {
    return @{ ok = $false; status = -1; content = $_.Exception.Message }
  }
}

function ListRows([string]$table, [string]$select, [string]$token) {
  $rr = TryRest 'GET' "/$table?select=$select" $null $token
  if (-not $rr.ok) { return @() }
  try { return @(($rr.content | ConvertFrom-Json)) } catch { return @() }
}

Write-Output "=== 1) إنشاء الحساب / تسجيل الدخول ==="
$ra = SignUp $emailA
if ($null -eq $ra -or -not $ra.access_token) {
  Write-Output "لم يُمنح session فوري لـ A (قد يكون تأكيد البريد مفعّلًا) — أحاول تسجيل الدخول مباشرة."
  $ra = SignIn $emailA
}
$rb = SignUp $emailB
if ($null -eq $rb -or -not $rb.access_token) { $rb = SignIn $emailB }

if (-not $ra.access_token -or -not $rb.access_token) {
  Write-Output ''
  Write-Output '[STOP] لا يمكن إنشاء الحسابين تجريبيًا بدون جلسة فورية.'
  Write-Output '  الحل: في لوحة Supabase → Authentication → Providers → Email → فعّل/أطفئ "Confirm email"'
  Write-Output '  حسب رغبتك، ثم أعد تشغيل هذا السكربت.'
  exit 2
}
$ta = $ra.access_token; $tb = $rb.access_token
$uidA = $ra.user.id; $uidB = $rb.user.id
Write-Output "  A: $emailA  (id مختصر: $($uidA.Substring(0,8))…)"
Write-Output "  B: $emailB  (id مختصر: $($uidB.Substring(0,8))…)"

Write-Output ''
Write-Output '=== 2) إنشاء بيانات أصلية لكل مستخدم ==='
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
Write-Output '=== 3) عزل القراءة ==='
$rowsB = ListRows 'entries' 'text' $tb
Check 'B لا يرى بيانات A نهائيًا' (-not ($rowsB.text -match 'QA-A1'))
$rowsA = ListRows 'entries' 'text' $ta
Check 'A يرى بياناته فقط' (($rowsA.text -match 'QA-A1') -and -not ($rowsA.text -match 'QA-B1'))

$direct = TryRest 'GET' "/entries?id=eq.$noteAId&select=id" $null $tb
Check 'B يطلب مهمة A بالمعرف المباشر → لا تُرجع' ($direct.status -eq 200 -and ($direct.content.Trim().TrimStart('[').TrimEnd(']').Trim().Length -eq 0))

Write-Output ''
Write-Output '=== 4) منع التعديل/الحذف على بيانات الآخرين ==='
$patch = TryRest 'PATCH' "/entries?id=eq.$noteAId" @{ text = 'QA-HACKED-BY-B' } $tb
Check 'B يعدّل مهمة A → مرفوض' (-not $patch.ok -and $patch.status -ge 400)
$del = TryRest 'DELETE' "/entries?id=eq.$noteAId" $null $tb
Check 'B يحذف مهمة A → مرفوض' (-not $del.ok -and $del.status -ge 400)

Write-Output ''
Write-Output '=== 5) محاولة إدراج باسم مالك آخر (tamper) ==='
$spoof = TryRest 'POST' '/entries' @{ kind = 'task'; text = "QA-SPOOF-BY-B $ts"; user_id = $uidA; priority = 'normal'; status = 'not_started'; description = 'spoof'; created_at = $t; updated_at = $t } $tb
$rowsA2 = ListRows 'entries' 'text' $ta
Check 'محاولة B إنشاء سجل باسم A → لا يظهر في بيانات A إطلاقًا' (-not ($rowsA2.text -match 'QA-SPOOF-BY-B'))
$spoofId = ''
if ($spoof.ok -and $spoof.content) { try { $spoofId = ($spoof.content | ConvertFrom-Json).id } catch { } }
$verSpoofOwner = 'لم يُنشأ'
if ($spoofId) {
  $obj = (TryRest 'GET' "/entries?id=eq.$spoofId&select=user_id" $null $tb)
  if ($obj.ok -and $obj.content -match $uidB) { $verSpoofOwner = 'أصبح تلقائيًا لـ B (trigger) ✓' }
  elseif ($obj.ok) { $verSpoofOwner = 'ملكية غير متوقعة!' }
}
Write-Output "  (تفصيلي: إن نجح الإدراج فملكيته أصبحت لـ B بفعل trigger => $verSpoofOwner)"

Write-Output ''
Write-Output '=== 6) تعديل/حذف بيانات النفس ==='
$patchOwn = TryRest 'PATCH' "/entries?id=eq.${noteAId}" @{ text = "QA-A1-NOTE-EDITED $ts" } $ta
Check 'A يعدّل مهمته → نجاح' ($patchOwn.ok)
$delOwnA = TryRest 'DELETE' "/entries?id=eq.${taskAId}" $null $ta
Check 'A يحذف مهمته → نجاح' ($delOwnA.ok)
$delOwnB = TryRest 'DELETE' "/entries?id=eq.${taskBId}" $null $tb
Check 'B يحذف سجله → نجاح' ($delOwnB.ok)

Write-Output ''
Write-Output '=== 7) الملف الشخصي (profiles) ==='
$profA = ListRows 'profiles' 'id' $ta
Check 'A يقرأ ملفه الشخصي' ($profA.Count -ge 1)
$profOther = TryRest 'GET' "/profiles?id=neq.$uidA&select=id" $null $ta
Check 'A لا يقرأ ملفات آخرين' ($profOther.ok -and ($profOther.content.Trim().TrimStart('[').TrimEnd(']').Trim().Length -eq 0))

Write-Output ''
Write-Output "======================================"
Write-Output "  النتيجة: PASS=$passCount  FAIL=$failCount"
Write-Output "  حسابات الاختبار: $emailA / $emailB"
Write-Output "  (يمكن حذفها من لوحة Supabase → Authentication → Users)"
Write-Output "======================================"
if ($failCount -gt 0) { exit 1 } else { exit 0 }