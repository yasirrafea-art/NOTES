import { useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText, Paperclip, X } from 'lucide-react'
import { db } from '../db'
import { fmtSize, nowISO } from '../lib/format'
import type { Attachment } from '../types'

interface Props {
  entryId?: string
  projectId?: string
}

export default function AttachmentSection({ entryId, projectId }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const list =
    useLiveQuery(async () => {
      const base =
        entryId != null
          ? db.attachments.where('entryId').equals(entryId).toArray()
          : db.attachments.where('projectId').equals(projectId!).toArray()
      return (await base).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }, [entryId, projectId]) ?? []

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const t = nowISO()
    for (const f of Array.from(files)) {
      await db.attachments.add({
        entryId: entryId ?? null,
        projectId: projectId ?? null,
        fileName: f.name,
        fileType: f.type || 'file',
        size: f.size,
        data: f,
        createdAt: t,
      })
    }
  }

  function download(a: Attachment) {
    const url = URL.createObjectURL(a.data)
    const el = document.createElement('a')
    el.href = url
    el.download = a.fileName
    el.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Paperclip className="h-4 w-4" />
          المرفقات
        </p>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="text-sm font-semibold text-brand-600 transition hover:text-brand-700"
        >
          إضافة ملفات
        </button>
        <input
          ref={ref}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">لا توجد مرفقات</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-sm">{a.fileName}</span>
              <span className="shrink-0 text-xs text-slate-400">{fmtSize(a.size)}</span>
              <button
                type="button"
                onClick={() => download(a)}
                className="text-brand-600 transition hover:text-brand-700"
                title="تحميل"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await db.attachments.delete(a.id!)
                }}
                className="text-slate-400 transition hover:text-red-600"
                title="حذف"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}