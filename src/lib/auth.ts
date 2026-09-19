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

// رسائل عربية بسيطة فقط — لا تظهر أي رسالة تقنية من Supabase للمستخدم.
function authError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'اسم المستخدم أو الرمز السري غير صحيح'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'اسم المستخدم مستخدم مسبقًا'
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
  if (error) return null
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
  if (error) console.error('[دفتر العمل] تعذر إنشاء الملف الشخصي:', error)
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
    return { error: error ? authError(error) : null }
  } finally {
    authOpsInFlight--
  }
}

export async function signUp(username: string, password: string): Promise<AuthResult> {
  const u = normalizeUsername(username)
  if (!u) return { error: USERNAME_INVALID_MSG }
  if (authOpsInFlight > 0) return { error: null, skipped: true }
  authOpsInFlight++
  try {
    needsDb()
    const { data, error } = await supabase!.auth.signUp({
      email: toAuthEmail(u),
      password,
      options: { data: { username: u, full_name: u } },
    })
    if (error) return { error: authError(error) }
    const user = data.user
    if (user) await ensureProfile(user.id, u)
    return { error: null, needsConfirmation: data.session == null }
  } finally {
    authOpsInFlight--
  }
}

export async function signOutUser(): Promise<void> {
  needsDb()
  await supabase!.auth.signOut()
}