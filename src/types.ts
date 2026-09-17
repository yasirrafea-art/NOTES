export type EntryKind = 'task' | 'note' | 'directive' | 'agreement'
export type Priority = 'normal' | 'important' | 'urgent'
export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'postponed'

export interface Entry {
  id: string
  kind: EntryKind
  text: string
  priority: Priority
  status?: TaskStatus | null
  projectId?: string | null
  dueDate?: string | null
  description?: string
  createdAt: string
  completedAt?: string | null
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color?: string
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  id?: number
  entryId?: string | null
  projectId?: string | null
  fileName: string
  fileType: string
  size: number
  data: Blob
  createdAt: string
}

export type ActivityType = 'add' | 'complete' | 'reopen' | 'status' | 'edit'

export interface Activity {
  id: string
  entryId?: string | null
  projectId?: string | null
  type: ActivityType
  kind?: EntryKind | null
  text: string
  createdAt: string
}