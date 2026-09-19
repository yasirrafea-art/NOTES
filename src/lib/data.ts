import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import { emitDataChange, onDataChange } from './events'
import type { Entry, EntryKind, Project, Activity } from '../types'
import { api, CONNECTION_ERROR } from './api'

const channels = new Map<string, RealtimeChannel>()

export function closeChannels(): void {
  channels.forEach((ch) => {
    try {
      supabase?.removeChannel(ch)
    } catch {
      // تجاهل أي خطأ أثناء الإزالة
    }
  })
  channels.clear()
}

function ensureChannel(table: string): void {
  if (!isSupabaseConfigured || !supabase || channels.has(table)) return
  const ch = supabase
    .channel(`rt-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => emitDataChange(table))
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[دفتر العمل] تعذّر تفعيل المزامنة الفورية للجدول ${table}`)
      }
    })
  channels.set(table, ch)
}

interface DataState<T> {
  data: T
  loading: boolean
  error: string | null
  refresh: () => void
}

function useData<T>(fetch: () => Promise<T>, table: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch

  const refresh = useCallback(() => {
    fetchRef.current()
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((err) => {
        console.error('[دفتر العمل] فشل جلب البيانات:', err)
        setError(CONNECTION_ERROR)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (table) {
      ensureChannel(table)
      const off = onDataChange(table, refresh)
      refresh()
      return off
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, refresh, ...deps])

  return { data, loading, error, refresh }
}

export function useEntries(opts: { limit?: number; kind?: EntryKind; notKind?: EntryKind } = {}): DataState<Entry[]> {
  const state = useData<Entry[]>(() => api.listEntries(opts), 'entries', [opts.limit, opts.kind, opts.notKind])
  return { ...state, data: state.data ?? [] }
}

export function useEntry(id: string | null): DataState<Entry | null> {
  const state = useData<Entry | null>(() => (id ? api.getEntry(id) : Promise.resolve(null)), id ? 'entries' : null, [id])
  return { ...state, data: state.data }
}

export function useProjects(): DataState<Project[]> {
  const state = useData<Project[]>(() => api.listProjects(), 'projects')
  return { ...state, data: state.data ?? [] }
}

export function useProject(id: string | null): DataState<Project | null> {
  const state = useData<Project | null>(() => (id ? api.getProject(id) : Promise.resolve(null)), id ? 'projects' : null, [id])
  return { ...state, data: state.data }
}

export function useEntriesByProject(projectId: string | null): DataState<Entry[]> {
  const state = useData<Entry[]>(() => (projectId ? api.listEntriesByProject(projectId) : Promise.resolve([])), projectId ? 'entries' : null, [projectId])
  return { ...state, data: state.data ?? [] }
}

export function useActivities(opts: { limit?: number } = {}): DataState<Activity[]> {
  const state = useData<Activity[]>(() => api.listActivities(opts), 'activities', [opts.limit])
  return { ...state, data: state.data ?? [] }
}