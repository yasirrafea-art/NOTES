import { supabase, isSupabaseConfigured } from './supabase'
import { emitDataChange } from './events'
import { nowISO } from './format'
import type { Activity, ActivityType, Entry, EntryKind, Priority, Project, TaskStatus } from '../types'

export const CONNECTION_ERROR = 'تعذر الاتصال بقاعدة البيانات، تحقق من الاتصال.'

function check(): void {
  if (!isSupabaseConfigured || !supabase) throw new Error(CONNECTION_ERROR)
}

function fail(err: unknown): never {
  console.error('[دفتر العمل] خطأ Supabase:', err)
  throw new Error(CONNECTION_ERROR)
}

export interface EntryPatch {
  kind?: EntryKind
  text?: string
  priority?: Priority
  status?: TaskStatus | null
  projectId?: string | null
  dueDate?: string | null
  description?: string | null
  completedAt?: string | null
}

interface EntryRow {
  id: string
  kind: EntryKind
  text: string
  description: string | null
  priority: Priority
  status: TaskStatus | null
  project_id: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  user_id: string | null
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  color: string | null
  created_at: string
  updated_at: string
  user_id: string | null
}

interface ActivityRow {
  id: string
  entry_id: string | null
  project_id: string | null
  type: ActivityType
  kind: EntryKind | null
  text: string
  created_at: string
  user_id: string | null
}

function entryOf(r: EntryRow): Entry {
  return {
    id: r.id,
    kind: r.kind,
    text: r.text,
    description: r.description ?? undefined,
    priority: r.priority,
    status: r.status,
    projectId: r.project_id,
    dueDate: r.due_date,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
  }
}

function projectOf(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function activityOf(r: ActivityRow): Activity {
  return {
    id: r.id,
    entryId: r.entry_id,
    projectId: r.project_id,
    type: r.type,
    kind: r.kind,
    text: r.text,
    createdAt: r.created_at,
  }
}

export const api = {
  async listEntries(opts: { limit?: number; kind?: EntryKind; notKind?: EntryKind } = {}): Promise<Entry[]> {
    check()
    let q = supabase!.from('entries').select('*')
    if (opts.kind) q = q.eq('kind', opts.kind)
    if (opts.notKind) q = q.neq('kind', opts.notKind)
    q = q.order('created_at', { ascending: false }).limit(opts.limit ?? 1000)
    const { data, error } = await q
    if (error) fail(error)
    return (data ?? []).map((r) => entryOf(r as EntryRow))
  },

  async listEntriesByProject(projectId: string, opts: { limit?: number } = {}): Promise<Entry[]> {
    check()
    const { data, error } = await supabase!
      .from('entries')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 1000)
    if (error) fail(error)
    return (data ?? []).map((r) => entryOf(r as EntryRow))
  },

  async getEntry(id: string): Promise<Entry | null> {
    check()
    const { data, error } = await supabase!.from('entries').select('*').eq('id', id).maybeSingle()
    if (error) fail(error)
    return data ? entryOf(data as EntryRow) : null
  },

  async addEntry(e: {
    kind: EntryKind
    text: string
    priority?: Priority
    status?: TaskStatus
    projectId?: string | null
    dueDate?: string | null
    description?: string | null
  }): Promise<Entry> {
    check()
    const t = nowISO()
    const { data, error } = await supabase!
      .from('entries')
      .insert({
        kind: e.kind,
        text: e.text,
        priority: e.priority ?? 'normal',
        status: e.status ?? (e.kind === 'task' ? 'not_started' : null),
        project_id: e.projectId ?? null,
        due_date: e.dueDate ?? null,
        description: e.description ?? null,
        completed_at: null,
        created_at: t,
        updated_at: t,
      })
      .select()
      .single()
    if (error) fail(error)
    emitDataChange('entries')
    return entryOf(data as EntryRow)
  },

  async updateEntry(id: string, patch: EntryPatch): Promise<void> {
    check()
    const row: Record<string, unknown> = {}
    if (patch.kind !== undefined) row.kind = patch.kind
    if (patch.text !== undefined) row.text = patch.text
    if (patch.priority !== undefined) row.priority = patch.priority
    if (patch.status !== undefined) row.status = patch.status
    if (patch.projectId !== undefined) row.project_id = patch.projectId
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate
    if (patch.description !== undefined) row.description = patch.description
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt
    row.updated_at = nowISO()
    const { error } = await supabase!.from('entries').update(row).eq('id', id)
    if (error) fail(error)
    emitDataChange('entries')
  },

  async deleteEntry(id: string): Promise<void> {
    check()
    const { error } = await supabase!.from('entries').delete().eq('id', id)
    if (error) fail(error)
    emitDataChange('entries')
    emitDataChange('activities')
  },

  async listProjects(): Promise<Project[]> {
    check()
    const { data, error } = await supabase!.from('projects').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) fail(error)
    return (data ?? []).map((r) => projectOf(r as ProjectRow))
  },

  async getProject(id: string): Promise<Project | null> {
    check()
    const { data, error } = await supabase!.from('projects').select('*').eq('id', id).maybeSingle()
    if (error) fail(error)
    return data ? projectOf(data as ProjectRow) : null
  },

  async addProject(p: { name: string; description?: string | null; color?: string }): Promise<Project> {
    check()
    const t = nowISO()
    const { data, error } = await supabase!
      .from('projects')
      .insert({
        name: p.name,
        description: p.description ?? null,
        color: p.color ?? 'violet',
        created_at: t,
        updated_at: t,
      })
      .select()
      .single()
    if (error) fail(error)
    emitDataChange('projects')
    return projectOf(data as ProjectRow)
  },

  async updateProject(id: string, patch: { name?: string; description?: string | null; color?: string }): Promise<void> {
    check()
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.description !== undefined) row.description = patch.description
    if (patch.color !== undefined) row.color = patch.color
    row.updated_at = nowISO()
    const { error } = await supabase!.from('projects').update(row).eq('id', id)
    if (error) fail(error)
    emitDataChange('projects')
  },

  async deleteProject(id: string): Promise<void> {
    check()
    const { error } = await supabase!.from('projects').delete().eq('id', id)
    if (error) fail(error)
    emitDataChange('projects')
    emitDataChange('entries')
    emitDataChange('activities')
  },

  async listActivities(opts: { limit?: number } = {}): Promise<Activity[]> {
    check()
    const { data, error } = await supabase!.from('activities').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 20)
    if (error) fail(error)
    return (data ?? []).map((r) => activityOf(r as ActivityRow))
  },

  async addActivity(a: {
    entryId?: string | null
    projectId?: string | null
    type: ActivityType
    kind?: EntryKind | null
    text: string
  }): Promise<void> {
    try {
      check()
      const { error } = await supabase!.from('activities').insert({
        entry_id: a.entryId ?? null,
        project_id: a.projectId ?? null,
        type: a.type,
        kind: a.kind ?? null,
        text: a.text,
        created_at: nowISO(),
      })
      if (error) {
        console.error('[دفتر العمل] فشل تسجيل النشاط:', error)
        return
      }
      emitDataChange('activities')
    } catch (err) {
      console.error('[دفتر العمل] فشل تسجيل النشاط:', err)
    }
  },
}