import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Notes from './pages/Notes'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Search from './pages/Search'
import Log from './pages/Log'
import Login from './pages/Login'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100">
      <p className="text-sm text-slate-400">جارٍ التحميل...</p>
    </div>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

// صفحة الدخول نفسها: المستخدم المسجل يُحوَّل مباشرة إلى الرئيسية
function LoginGate() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (user) return <Navigate to="/" replace />
  return <Login />
}

// مسار روابط استعادة كلمة المرور (#access_token=...&type=recovery):
// نبقى نعرض شاشة انتظار حتى يعالج Supabase التوكن ثم يتجه تلقائيًا إلى الرئيسية
function RecoveryGate() {
  const { user } = useAuth()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (user) return
    const t = window.setTimeout(() => setFailed(true), 8000)
    return () => window.clearTimeout(t)
  }, [user])

  if (user) return <Navigate to="/" replace />
  if (failed) return <Navigate to="/login" replace />
  return <Splash />
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginGate />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/log" element={<Log />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/search" element={<Search />} />
          </Route>
          <Route path="*" element={<RecoveryGate />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}