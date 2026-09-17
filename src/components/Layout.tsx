import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  BookOpenText,
  FolderKanban,
  History,
  House,
  ListTodo,
  NotebookPen,
  Search,
  Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'

const sidebarNav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'الرئيسية', icon: House, end: true },
  { to: '/tasks', label: 'المهام', icon: ListTodo },
  { to: '/notes', label: 'الملاحظات', icon: NotebookPen },
  { to: '/log', label: 'السجل الزمني', icon: History },
  { to: '/projects', label: 'المشاريع', icon: FolderKanban },
]

const bottomNav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'الرئيسية', icon: House, end: true },
  { to: '/tasks', label: 'المهام', icon: ListTodo },
  { to: '/notes', label: 'الملاحظات', icon: NotebookPen },
  { to: '/projects', label: 'المشاريع', icon: FolderKanban },
  { to: '/search', label: 'البحث', icon: Search },
]

function navLinkCls({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`
}

function bottomLinkCls({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition ${
    isActive ? 'text-brand-700' : 'text-slate-400'
  }`
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <aside className="fixed start-0 top-0 bottom-0 z-40 hidden w-72 flex-col border-e border-slate-200 bg-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
            <BookOpenText className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold text-slate-800">دفتر العمل</span>
        </Link>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {sidebarNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkCls}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Database className="h-3.5 w-3.5" />
            {isSupabaseConfigured ? 'بياناتك محفوظة في السحابة (Supabase)' : 'التخزين السحابي غير مفعّل بعد'}
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-800">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
              <BookOpenText className="h-4 w-4" />
            </span>
            دفتر العمل
          </Link>
          <div className="flex items-center gap-0.5">
            <Link to="/log" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="السجل الزمني">
              <History className="h-5 w-5" />
            </Link>
            <Link to="/search" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="البحث">
              <Search className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-28 lg:ps-72 lg:pb-10">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">لم يتم ربط قاعدة البيانات بعد</p>
              <p className="mt-1 text-amber-800">
                أضف المفتاحين <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> و{' '}
                <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> في ملف .env ثم أعد
                التشغيل.
              </p>
            </div>
          )}
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/90 backdrop-blur lg:hidden">
        {bottomNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={bottomLinkCls}>
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}