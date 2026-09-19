import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getProfile, ensureProfile, signOutUser, type Profile } from '../lib/auth'
import { closeChannels } from '../lib/data'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth يجب استخدامه داخل AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (uid?: string): Promise<void> => {
    if (!supabase) {
      setProfile(null)
      return
    }
    let id = uid
    if (!id) {
      const { data } = await supabase.auth.getUser()
      id = data.user?.id
    }
    if (!id) {
      setProfile(null)
      return
    }
    let p = await getProfile(id)
    if (!p) {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email
      await ensureProfile(id, email && email.includes('@') ? email.split('@')[0] : null)
      p = await getProfile(id)
    }
    setProfile(p)
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await signOutUser()
    } finally {
      closeChannels()
      setUser(null)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      const u = data.session?.user ?? null
      setUser(u)
      setLoading(false)
      if (u) void refreshProfile(u.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      const u = session?.user ?? null
      console.info(`[دفتر العمل][auth:onAuthStateChange] event=${_event} user=${u?.id ?? 'none'}`)
      setUser(u)
      if (u) {
        void refreshProfile(u.id)
      } else {
        closeChannels()
        setProfile(null)
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [refreshProfile])

  return <AuthContext.Provider value={{ user, profile, loading, refreshProfile, logout }}>{children}</AuthContext.Provider>
}