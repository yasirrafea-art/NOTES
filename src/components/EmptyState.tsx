import type { LucideIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="card p-8 text-center">
      <Icon className="mx-auto h-9 w-9 text-slate-300" />
      <p className="mt-3 font-medium text-slate-500">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </div>
  )
}