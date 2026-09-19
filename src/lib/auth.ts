import { supabase, isSupabaseConfigured } from './supabase'

export interface Profile {
  id: string
  username: string | null
  fullName: string | null
}

export interface AuthResult {
  error: string | null
  needsConfirmation?: boolean
}

export const AUTH_ERROR = 'تعذر الاتصال بالخدمة، تحقق من الاتصال ثم أعد المحاولة.'

// نطاق مخصص داخلي لتحويل username إلى معرّف فريد داخل auth.users.email.
// هكذا يبقى Auth وآلية الجلسات وRLS (auth.uid()) كما هي دون تغيير.
const EMAIL_DOMAIN = 'workbook.local'

export const USERNAME_INVALID_MSG =
  'اسم المستخدم يجب أن يتكون من 3-24 حرفًا (حروف إنجليزية، أرقام، أو _ . -).'

function authError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'اسم المستخدم أو الرمز السري غير صحيح.'
  if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed'))
    return 'الحساب لم يُفعَّل بعد — أطفئ "Confirm email" في لوحة Supabase ثم أعد المحاولة.'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'اسم المستخدم مسجَّل مسبقًا — اختر اسمًا آخر.'
  if (msg.includes('Password should be') || msg.includes('password') && msg.includes('too short'))
    return 'الرمز السري قصير جدًا (6 أحرف على الأقل).'
  if (msg.includes('rate limit') || msg.includes('Too Many Requests'))
    return 'طلبات كثيرة جدًا — انتظر قليلًا ثم أعد المحاولة.'
  return 'تعذر تنفيذ العملية، تحقق من المدخلات ثم أعد المحاولة.'
}

function needsDb(): boolean {
  if (!isSupabaseConfigured || !supabase) throw new Error(AUTH_ERROR)
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

export async function signIn(username: string, password: string): Promise<AuthResult> {
  const u = normalizeUsername(username)
  if (!u) return { error: USERNAME_INVALID_MSG }
  needsDb()
  const { error } = await supabase!.auth.signInWithPassword({
    email: toAuthEmail(u),
    password,
  })
  return { error: error ? authError(error) : null }
}

export async function signUp(username: string, password: string): Promise<AuthResult> {
  const u = normalizeUsername(username)
  if (!u) return { error: USERNAME_INVALID_MSG }
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
}

export async function signOutUser(): Promise<void> {
  needsDb()
  await supabase!.auth.signOut()
}