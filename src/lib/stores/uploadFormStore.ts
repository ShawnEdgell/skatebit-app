// src/lib/features/stats/components/uploadFormStore.ts
import { writable } from 'svelte/store'

export const selectedFilePath = writable<string | null>(null)
export const selectedFileContent = writable<string | null>(null)
export const selectedOriginalName = writable<string | null>(null)

export const uploadFileName = writable<string>('') // What user sees for editing
export const uploadDescription = writable<string>('') // Optional description
