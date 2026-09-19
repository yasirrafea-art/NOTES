import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpenText } from 'lucide-react'
import { signIn, signUp, USERNAME_INVALID_MSG } from '../lib/auth'
import { useAuth } from '../auth/AuthContext'

type Mode = 'signin' | 'signup'

const MODE_META: Record<Mode, { title: string; submit: string; hint: string }> = {
  signin: { title: 'تسجيل الدخول', submit: 'تسجيل الدخول', hint: 'أهلًا بعودتك — سجّل دخولك باسم المستخدم الخاص بك.' },
  signup: { title: 'إنشاء حساب جديد', submit: 'إنشاء الحساب', hint: 'أنشئ حسابك لاستخدام دفتر العمل الخاص بك.' },
}

export default function Login() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const meta = MODE_META[mode]

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  const canSubmit =
    username.trim().length > 0 &&
    password.length > 0 &&
    (mode !== 'signup' || (confirm.length > 0 && password === confirm)) &&
    !busy

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'signin') {
        const res = await signIn(username, password)
        if (res.error) setError(res.error)
      } else {
        if (!/^[a-z0-9._-]{3,24}$/i.test(username.trim())) {
          setError(USERNAME_INVALID_MSG)
          return
        }
        if (password.length < 6) {
          setError('الرمز السري يجب أن يكون 6 أحرف على الأقل.')
          return
        }
        if (password !== confirm) {
          setError('الرمز السري وتأكيده غير متطابقين.')
          return
        }
        const res = await signUp(username, password)
        if (res.error) {
          setError(res.error)
        } else if (res.needsConfirmation) {
          setInfo(
            'تم إنشاء الحساب، لكن الجلسة لم تُمنح فورًا — أطفئ "Confirm email" في لوحة Supabase ليتمكن تسجيل الدخول، ثم أعد المحاولة.',
          )
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white">
            <BookOpenText className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold text-slate-800">دفتر العمل</span>
        </div>

        <div className="card p-6">
          <h1 className="text-center text-lg font-bold text-slate-800">{meta.title}</h1>
          <p className="mt-1 text-center text-sm text-slate-500">{meta.hint}</p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
          )}
          {info && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{info}</p>
          )}

          <div className="mt-5 space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input"
              dir="ltr"
              style={{ textAlign: 'end' }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="الرمز السري"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="input"
              dir="ltr"
              style={{ textAlign: 'end' }}
            />
            {mode === 'signup' && (
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                placeholder="تأكيد الرمز السري"
                autoComplete="new-password"
                className="input"
                dir="ltr"
                style={{ textAlign: 'end' }}
              />
            )}
            {mode === 'signup' && (
              <p className="text-xs text-slate-400">
                اسم المستخدم: 3-24 حرفًا (حروف إنجليزية، أرقام، أو _ . -) — الرمز السري: 6 أحرف على الأقل.
              </p>
            )}
            <button onClick={() => void submit()} disabled={!canSubmit} className="btn-primary w-full">
              {busy ? '...' : meta.submit}
            </button>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm">
            {mode === 'signin' ? (
              <button onClick={() => switchMode('signup')} className="font-semibold text-brand-600 hover:text-brand-700">
                إنشاء حساب جديد
              </button>
            ) : (
              <button onClick={() => switchMode('signin')} className="font-semibold text-brand-600 hover:text-brand-700">
                لدي حساب — تسجيل الدخول
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          بياناتك خاصة بك وحدك ومحمية بعزل كامل بين الحسابات.
        </p>
      </div>
    </div>
  )
}