import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpenText } from 'lucide-react'
import { resetPassword, signIn, signUp } from '../lib/auth'
import { useAuth } from '../auth/AuthContext'

type Mode = 'signin' | 'signup' | 'forgot'

const MODE_META: Record<Mode, { title: string; submit: string; hint: string }> = {
  signin: { title: 'تسجيل الدخول', submit: 'دخول', hint: 'أهلًا بعودتك — سجّل دخولك لمتابعة عملك.' },
  signup: { title: 'إنشاء حساب جديد', submit: 'إنشاء الحساب', hint: 'أنشئ حسابك المجاني لاستخدام دفتر العمل الخاص بك.' },
  forgot: { title: 'استعادة كلمة المرور', submit: 'إرسال رابط الاستعادة', hint: 'سنرسل لك رابطًا لإعادة تعيين كلمة المرور.' },
}

export default function Login() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    email.trim().length > 0 &&
    (mode === 'forgot' || password.length > 0) &&
    (mode !== 'signup' || name.trim().length > 0) &&
    !busy

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    let res: { error: string | null; needsConfirmation?: boolean } = { error: null }
    try {
      if (mode === 'signin') {
        res = await signIn(email.trim(), password)
      } else if (mode === 'signup') {
        res = await signUp(email.trim(), password, name)
        if (!res.error && res.needsConfirmation) {
          setInfo('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.')
        }
      } else {
        res = await resetPassword(email.trim())
        if (!res.error) {
          setInfo('إذا كان البريد مسجلًا عندنا، سيصلك رابط إعادة تعيين كلمة المرور.')
        }
      }
      if (res.error) setError(res.error)
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
            {mode === 'signup' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الذي سيظهر داخل النظام"
                className="input"
              />
            )}
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="البريد الإلكتروني"
              autoComplete="email"
              className="input"
              dir="ltr"
              style={{ textAlign: 'end' }}
            />
            {mode !== 'forgot' && (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="كلمة المرور"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="input"
                dir="ltr"
                style={{ textAlign: 'end' }}
              />
            )}
            <button
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="btn-primary w-full"
            >
              {busy ? '...' : meta.submit}
            </button>
          </div>

          <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-center text-sm">
            {mode === 'signin' && (
              <>
                <button onClick={() => switchMode('signup')} className="font-semibold text-brand-600 hover:text-brand-700">
                  إنشاء حساب جديد
                </button>
                <div>
                  <button onClick={() => switchMode('forgot')} className="text-slate-500 hover:text-brand-600">
                    نسيت كلمة المرور؟
                  </button>
                </div>
              </>
            )}
            {mode === 'signup' && (
              <button onClick={() => switchMode('signin')} className="font-semibold text-brand-600 hover:text-brand-700">
                لدي حساب — تسجيل الدخول
              </button>
            )}
            {mode === 'forgot' && (
              <button onClick={() => switchMode('signin')} className="font-semibold text-brand-600 hover:text-brand-700">
                رجوع إلى تسجيل الدخول
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