import { writable } from 'svelte/store'

export const isDraggingOver = writable(false)

export const activeDropTargetInfo = writable<{
  path: string | null
  label: string | null
}>({ path: null, label: null })
