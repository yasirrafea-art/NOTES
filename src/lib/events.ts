type Handler = () => void

const listeners = new Map<string, Set<Handler>>()

export function onDataChange(table: string, fn: Handler): () => void {
  let set = listeners.get(table)
  if (!set) {
    set = new Set()
    listeners.set(table, set)
  }
  set.add(fn)
  return () => {
    set.delete(fn)
  }
}

export function emitDataChange(table: string) {
  listeners.get(table)?.forEach((fn) => fn())
}