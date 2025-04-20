import FlexSearch from 'flexsearch'
import type { FsEntry } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'
import type { StoredModData, StoredFsEntryData } from '$lib/types/searchTypes'

export class LocalMapsSearchIndex {
  private index = new FlexSearch.Document({
    tokenize: 'full',
    cache: true,
    document: {
      id: 'path',
      index: ['name'],
      store: [
        'name',
        'path',
        'isDirectory',
        'size',
        'modified',
        'thumbnailPath',
        'thumbnailMimeType',
      ],
    },
  })

  add(entries: FsEntry[]): void {
    entries.forEach((entry) => {
      if (entry && entry.path) {
        const docToAdd: StoredFsEntryData = {
          path: entry.path,
          name: entry.name ?? '',
          isDirectory: entry.isDirectory ?? undefined,
          size: entry.size ?? undefined,
          modified: entry.modified ?? undefined,
          thumbnailMimeType: entry.thumbnailMimeType ?? undefined,
        }
        try {
          this.index.add(entry.path, docToAdd as any)
        } catch (error) {
          // Keep error log for debugging potential add issues
          console.error(
            `[LocalMapsSearchIndex.add] Error adding entry path ${entry.path} to index:`,
            error,
            docToAdd,
          )
        }
      }
    })
  }

  clear(): void {
    this.index.clear()
  }

  async search(query: string, limit = 100): Promise<FsEntry[]> {
    const searchResults: unknown = await this.index.searchAsync(query, limit, {
      enrich: true,
      index: ['name'],
    })

    const finalResults: FsEntry[] = []
    const seenPaths = new Set<string>()

    if (Array.isArray(searchResults)) {
      searchResults.forEach((fieldResultSet: any) => {
        if (fieldResultSet && Array.isArray(fieldResultSet.result)) {
          fieldResultSet.result.forEach(
            (resultItem: { id: string; doc: any }) => {
              const pathId = resultItem.id
              const storedDoc = resultItem.doc

              if (
                pathId &&
                typeof pathId === 'string' &&
                storedDoc &&
                !seenPaths.has(pathId)
              ) {
                const entry: FsEntry = {
                  path: pathId,
                  name:
                    typeof storedDoc.name === 'string' ? storedDoc.name : null,
                  isDirectory:
                    typeof storedDoc.isDirectory === 'boolean'
                      ? storedDoc.isDirectory
                      : false,
                  size:
                    typeof storedDoc.size === 'number' ? storedDoc.size : null,
                  modified:
                    typeof storedDoc.modified === 'number'
                      ? storedDoc.modified
                      : null,
                  thumbnailPath:
                    typeof storedDoc.thumbnailPath === 'string'
                      ? storedDoc.thumbnailPath
                      : null,
                  thumbnailMimeType:
                    typeof storedDoc.thumbnailMimeType === 'string'
                      ? storedDoc.thumbnailMimeType
                      : null,
                }
                finalResults.push(entry)
                seenPaths.add(pathId)
              }
            },
          )
        }
      })
    }
    return finalResults
  }
}

export class ModSearchIndex {
  private index = new FlexSearch.Document({
    tokenize: 'forward',
    cache: true,
    document: {
      id: 'id',
      index: ['name', 'summary', 'tagNames'],
      store: [
        'id',
        'name',
        'summary',
        'profile_url',
        'date_updated',
        'tagNames',
        'imageUrl',
      ],
    },
  })

  add(mods: Mod[]): void {
    mods.forEach((mod) => {
      if (!mod || typeof mod.id !== 'number' || !mod.name) {
        // Keep warning for bad data
        console.warn(
          `[ModSearchIndex.add] Skipping mod with missing id/name:`,
          mod,
        )
        return
      }
      const docToAdd: StoredModData = {
        id: mod.id,
        name: mod.name,
        summary: mod.summary ?? '',
        profile_url: mod.profile_url ?? '',
        date_updated: mod.date_updated ?? 0,
        tagNames: mod.tags?.map((tag) => tag.name).join(' ') ?? '',
        imageUrl: mod.logo?.thumb_320x180 ?? undefined,
      }
      try {
        this.index.add(mod.id, docToAdd as any)
      } catch (error) {
        // Keep error log for debugging potential add issues
        console.error(
          `[ModSearchIndex.add] Error adding mod ID ${mod.id} to index:`,
          error,
          docToAdd,
        )
      }
    })
  }

  clear(): void {
    this.index.clear()
  }

  async search(query: string, limit = 100): Promise<StoredModData[]> {
    const searchResults: unknown = await this.index.searchAsync(query, limit, {
      enrich: true,
      index: ['name', 'summary', 'tagNames'],
    })

    const finalResults: StoredModData[] = []
    const seenIds = new Set<number>()

    if (Array.isArray(searchResults)) {
      searchResults.forEach((fieldResultSet: any) => {
        if (fieldResultSet && Array.isArray(fieldResultSet.result)) {
          fieldResultSet.result.forEach(
            (resultItem: { id: number; doc: StoredModData }) => {
              const modId = resultItem.id
              const storedDoc = resultItem.doc
              if (
                modId &&
                typeof modId === 'number' &&
                storedDoc &&
                !seenIds.has(modId)
              ) {
                finalResults.push(storedDoc)
                seenIds.add(modId)
              }
            },
          )
        }
      })
    }
    return finalResults
  }
}

export const localMapsSearchIndex = new LocalMapsSearchIndex()
export const modioMapsSearchIndex = new ModSearchIndex()
