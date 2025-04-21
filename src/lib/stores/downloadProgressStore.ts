import { writable } from 'svelte/store'
import type { InstallationProgress } from '$lib/types/downloadTypes'

type ExtendedProgress = InstallationProgress & {
  source: string
  label?: string
}

export const downloadProgress = writable<Record<string, ExtendedProgress>>({})
