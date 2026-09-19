import { supabase, isSupabaseConfigured } from './supabase'

export interface Profile {
  id: string
  username: string | null
  fullName: string | null
}

export interface AuthResult {
  error: string | null
  needsConfirmation?: boolean
  skipped?: boolean
}

// نطاق مخصص داخلي لتحويل username إلى معرّف فريد داخل auth.users.email.
// هكذا يبقى Auth وآلية الجلسات وRLS (auth.uid()) كما هي دون تغيير.
const EMAIL_DOMAIN = 'workbook.local'

export const USERNAME_INVALID_MSG =
  'اسم المستخدم يجب أن يتكون من 3-24 حرفًا (حروف إنجليزية، أرقام، أو _ . -).'

// سجّل تفاصيل الخطأ التقنية كاملة في console (للمطور)
// مع بقاء الرسالة المعروضة للمستخدم عربية بسيطة.
function logAuthError(context: string, err: unknown): void {
  const e = err as {
    message?: string
    code?: string
    details?: string
    hint?: string
    status?: number
  } | null
  console.error(`[دفتر العمل] خطأ في ${context}:`, {
    message: e?.message ?? String(err),
    code: e?.code ?? null,
    details: e?.details ?? null,
    hint: e?.hint ?? null,
    status: e?.status ?? null,
  })
}

// رسائل عربية بسيطة إلا عند وجود سبب حقيقي قابل للتشخيص.
function authError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'اسم المستخدم أو الرمز السري غير صحيح'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'اسم المستخدم مستخدم مسبقًا'
  // السبب الحقيقي للـ 429 في التسجيل: إرسال بريد تأكيد (Confirm email مفعّل في Supabase).
  // أعرضه للمستخدم بعبارة عربية قابلة للتنفيذ بدل الجملة العامة.
  if (msg.includes('rate limit') || msg.includes('Too Many Requests') || msg.includes('over_email_send_rate_limit'))
    return 'تعذر إنشاء الحساب: خيار "تأكيد البريد" مفعّل في Supabase ويستنفد حد الإرسال — أطفئه ثم أعد المحاولة.'
  return 'حدث خطأ، حاول مرة أخرى'
}

function needsDb(): boolean {
  if (!isSupabaseConfigured || !supabase) throw new Error('حدث خطأ، حاول مرة أخرى')
  return true
}

// تطبيع اسم المستخدم (تقشير + أحرف صغيرة + تحقق من الصيغة) وصفته في البريد
export function normalizeUsername(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,24}$/.test(s)) return null
  return s
}

function toAuthEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`
}

export async function getProfile(userId: string): Promise<Profile | null> {
  needsDb()
  const { data, error } = await supabase!
    .from('profiles')
    .select('id, username, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    logAuthError('getProfile', error)
    return null
  }
  if (!data) return null
  return {
    id: data.id as string,
    username: (data.username as string | null) ?? null,
    fullName: (data.full_name as string | null) ?? null,
  }
}

export async function ensureProfile(userId: string, username?: string | null): Promise<void> {
  needsDb()
  const { error } = await supabase!.from('profiles').upsert(
    {
      id: userId,
      username: (username && username.trim()) || null,
      full_name: (username && username.trim()) || null,
    },
    { onConflict: 'id' },
  )
  if (error) logAuthError('ensureProfile', error)
}

// قفل يحول دون إرسال أكثر من طلب واحد لنفس العملية (دخول/إنشاء) في الوقت نفسه،
// مهما كانت النقرات المتكررة أو إعادة المحاولة — وبهذا لا تظهر 429 من Supabase.
let authOpsInFlight = 0

export async function signIn(username: string, password: string): Promise<AuthResult> {
  const u = normalizeUsername(username)
  if (!u) return { error: USERNAME_INVALID_MSG }
  if (authOpsInFlight > 0) return { error: null, skipped: true }
  authOpsInFlight++
  try {
    needsDb()
    const { error } = await supabase!.auth.signInWithPassword({
      email: toAuthEmail(u),
      password,
    })
    if (error) logAuthError('signIn', error)
    return { error: error ? authError(error) : null }
  } finally {
    authOpsInFlight--
  }
}

export async function signUp(username: string, password: string): Promise<AuthResult> {
  const trace: string[] = []
  const step = (name: string, extra?: unknown): void => {
    console.info(`[دفتر العمل][signup:${name}]`, extra ?? '')
    trace.push(name)
  }

  step('1-validate-username', { username })
  const u = normalizeUsername(username)
  if (!u) return { error: USERNAME_INVALID_MSG }

  step('2-validate-password', { len: password.length })
  if (password.length < 6) return { error: 'الرمز السري قصير جدًا (6 أحرف على الأقل).' }

  if (authOpsInFlight > 0) {
    step('skip-concurrent-request')
    return { error: null, skipped: true }
  }
  authOpsInFlight++
  try {
    needsDb()

    // 3) إنشاء المستخدم داخل Supabase Auth.
    // لا يُعرض Email في الواجهة أبدًا؛ يستخدم حقل البريد كمعرّف داخلي فريد
    // بالصيغة  username@workbook.local  (ربط ثابت وواحد لواحد — ليس عشوائيًا)،
    // وكلمة المرور تُشفَّر تلقائيًا داخل GoTrue (bcrypt) ولا تخزن كنص عادي.
    const authEmail = toAuthEmail(u)
    step('3-create-auth-user', { email: authEmail })
    const { data, error } = await supabase!.auth.signUp({
      email: authEmail,
      password,
      options: { data: { username: u, full_name: u } },
    })
    if (error) {
      logAuthError('signUp', error)
      step('3-create-auth-user-FAILED', { message: error.message, code: error.code, status: error.status })
      return { error: authError(error) }
    }

    // 4) الحصول على user.id (متوفر حتى إن لم تُمنح جلسة فورية)
    const user = data.user
    if (!user) {
      step('4-no-user-id')
      return { error: 'حدث خطأ، حاول مرة أخرى' }
    }
    step('4-user-id', { id: user.id })

    // 6) الجلسة: إن لم تكن فورية، فالسبب إعداد الخادم نفسه (Confirm email مفعّل)
    // ولا يمكن لأي كود عميل تجاوزه بأمان. نعرض رسالة محددة بدل الجملة العامة.
    if (!data.session) {
      step('6-no-session-confirm-email-ON')
      return { error: null, needsConfirmation: true }
    }
    step('6-session-ok')

    // 5) إنشاء profile بعد توفر user.id + جلسة صالحة (RLS: auth.uid() مسجّل)
    step('5-create-profile', { id: user.id })
    await ensureProfile(user.id, u)
    step('5-create-profile-ok')

    step('7-auto-login-redirect-home')
    return { error: null }
  } finally {
    authOpsInFlight--
  }
}

export async function signOutUser(): Promise<void> {
  needsDb()
  await supabase!.auth.signOut()
}