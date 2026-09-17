import Dexie, { type Table } from 'dexie'
import type { Activity, Attachment, Entry, EntryKind, Project } from '../types'

export class WorkBookDB extends Dexie {
  entries!: Table<Entry, number>
  projects!: Table<Project, number>
  attachments!: Table<Attachment, number>
  activities!: Table<Activity, number>

  constructor() {
    super('workbook')
    this.version(1).stores({
      entries: '++id, kind, priority, status, projectId, dueDate, createdAt, updatedAt, completedAt',
      projects: '++id, name, createdAt, updatedAt',
      attachments: '++id, entryId, projectId, createdAt',
    })
    this.version(2)
      .stores({
        entries: '++id, kind, priority, status, projectId, dueDate, createdAt, updatedAt, completedAt',
        projects: '++id, name, createdAt, updatedAt',
        attachments: '++id, entryId, projectId, createdAt',
        activities: '++id, entryId, type, createdAt',
      })
      .upgrade(async (tx) => {
        const rows: { id?: number; kind?: EntryKind; text?: string; createdAt?: string; projectId?: number | null }[] =
          await tx.table('entries').toArray()
        if (rows.length > 0) {
          await tx.table('activities').bulkAdd(
            rows.map((e) => ({
              entryId: e.id ?? null,
              projectId: e.projectId ?? null,
              kind: e.kind,
              text: e.text ?? '',
              type: 'add' as const,
              createdAt: e.createdAt ?? new Date().toISOString(),
            })),
          )
        }
      })
  }
}

export const db = new WorkBookDB()