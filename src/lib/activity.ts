import * as api from './api'
import type { ActivityType, EntryKind } from '../types'

export function logActivity(a: {
  entryId?: string | null
  projectId?: string | null
  type: ActivityType
  kind?: EntryKind | null
  text: string
}): Promise<void> {
  return api.addActivity(a)
}