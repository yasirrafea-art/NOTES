import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export type SupabaseEnvStatus = 'ok' | 'missing' | 'invalid'

export interface SupabaseConfigStatus {
  url: SupabaseEnvStatus
  key: SupabaseEnvStatus
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url: SupabaseEnvStatus = !rawUrl
    ? 'missing'
    : isValidUrl(rawUrl)
      ? 'ok'
      : 'invalid'
  const key: SupabaseEnvStatus = rawKey ? 'ok' : 'missing'
  return { url, key }
}

// فعّال فقط إذا كان الرابط صالحًا والمفتاح موجودًا
const configStatus = getSupabaseConfigStatus()
export const isSupabaseConfigured = configStatus.url === 'ok' && configStatus.key === 'ok'

// إنشاء العميل داخل try/catch حتى يستحيل أن تُسقط أي قيمة بيئة التطبيق ببياض
let client: SupabaseClient | null = null
if (isSupabaseConfigured) {
  try {
    client = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (err) {
    console.error('[دفتر العمل] تعذر إنشاء عميل Supabase:', err)
    client = null
  }
}

export const supabase: SupabaseClient | null = client