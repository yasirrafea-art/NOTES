import { supabase, isSupabaseConfigured } from './supabase'

export interface Profile {
  id: string
  fullName: string | null
}

export interface AuthResult {
  error: string | null
  needsConfirmation?: boolean
}

export const AUTH_ERROR = 'تعذر الاتصال بالخدمة، تحقق من الاتصال ثم أعد المحاولة.'

function authError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (msg.includes('Email not confirmed')) return 'لم يتم تأكيد البريد الإلكتروني بعد — تحقق من رسالتك الواردة.'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'هذا البريد الإلكتروني مسجَّل مسبقًا — استخدم «نسيت كلمة المرور» أو سجّل الدخول.'
  if (msg.includes('Password should be')) return 'كلمة المرور قصيرة جدًا (6 أحرف على الأقل).'
  if (msg.includes('Unable to validate email address')) return 'البريد الإلكتروني غير صالح.'
  if (msg.includes('rate limit') || msg.includes('Too Many Requests')) return 'طلبات كثيرة جدًا — انتظر قليلًا ثم أعد المحاولة.'
  return 'تعذر تنفيذ العملية، تحقق من صحة المدخلات ثم أعد المحاولة.'
}

function needsDb(): boolean {
  if (!isSupabaseConfigured || !supabase) throw new Error(AUTH_ERROR)
  return true
}

export async function getProfile(userId: string): Promise<Profile | null> {
  needsDb()
  const { data, error } = await supabase!
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  if (!data) return null
  return { id: data.id as string, fullName: (data.full_name as string | null) ?? null }
}

export async function ensureProfile(userId: string, name?: string | null): Promise<void> {
  needsDb()
  const { error } = await supabase!.from('profiles').upsert(
    { id: userId, full_name: (name && name.trim()) || null },
    { onConflict: 'id' },
  )
  if (error) console.error('[دفتر العمل] تعذر إنشاء الملف الشخصي:', error)
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  needsDb()
  const { error } = await supabase!.auth.signInWithPassword({ email, password })
  return { error: error ? authError(error) : null }
}

export async function signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
  needsDb()
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName.trim() || null } },
  })
  if (error) return { error: authError(error) }
  const user = data.user
  if (user) {
    const prefix = email.includes('@') ? email.split('@')[0] : null
    await ensureProfile(user.id, fullName.trim() || prefix)
  }
  return { error: null, needsConfirmation: data.session == null }
}

export async function signOutUser(): Promise<void> {
  needsDb()
  await supabase!.auth.signOut()
}

export async function resetPassword(email: string): Promise<AuthResult> {
  needsDb()
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const { error } = await supabase!.auth.resetPasswordForEmail(email, {
    redirectTo: base,
  })
  return { error: error ? authError(error) : null }
}

export async function updateProfileName(userId: string, fullName: string): Promise<AuthResult> {
  needsDb()
  const { error } = await supabase!.from('profiles').update({ full_name: fullName.trim() || null }).eq('id', userId)
  return { error: error ? AUTH_ERROR : null }
}