import FlexSearch from 'flexsearch'
import type { FsEntry } from '$lib/types/fsTypes'
import type { Mod } from '$lib/types/modioTypes'
import type { StoredFsEntryData, StoredModData } from '$lib/types/searchTypes'

export class LocalMapsSearchIndex {
  private index = new FlexSearch.Document({
    tokenize: 'full',
    cache: true,
    document: {
      id: 'path',
      index: ['name'],
      store: [
        'path',
        'name',
        'isDirectory',
        'size',
        'modified',
        'thumbnailPath',
        'thumbnailMimeType',
      ],
    },
  })

  add(entries: FsEntry[]): void {
    for (const e of entries) {
      if (!e.path) continue
      const doc: StoredFsEntryData = {
        path: e.path,
        name: e.name ?? '',
        isDirectory: Boolean(e.isDirectory),
        size: e.size ?? null,
        modified: e.modified ?? null,
        thumbnailPath: e.thumbnailPath ?? null,
        thumbnailMimeType: e.thumbnailMimeType ?? null,
      }
      try {
        ;(this.index as any).add(e.path, doc)
      } catch (err) {
        console.error('[LocalMapsSearchIndex] add failed', e.path, err, doc)
      }
    }
  }

  clear(): void {
    ;(this.index as any).clear()
  }

  async search(query: string, limit = 100): Promise<FsEntry[]> {
    const hits = (await (this.index as any).searchAsync(query, limit, {
      enrich: true,
    })) as Array<{ result: Array<{ id: string; doc: StoredFsEntryData }> }>

    const seen = new Set<string>()
    const out: FsEntry[] = []

    for (const block of hits) {
      if (!Array.isArray(block.result)) continue
      for (const { id, doc } of block.result) {
        if (seen.has(id)) continue
        seen.add(id)
        out.push({
          path: id,
          name: doc.name || null,
          isDirectory: Boolean(doc.isDirectory),
          size: doc.size,
          modified: doc.modified,
          thumbnailPath: doc.thumbnailPath,
          thumbnailMimeType: doc.thumbnailMimeType,
        })
      }
    }
    return out
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
    for (const m of mods) {
      if (typeof m.id !== 'number' || !m.name) continue
      const doc: StoredModData = {
        id: m.id,
        name: m.name,
        summary: m.summary ?? '',
        profile_url: m.profile_url,
        date_updated: m.date_updated,
        tagNames: m.tags?.map((t) => t.name).join(' ') ?? '',
        imageUrl: m.logo?.thumb_320x180 ?? null,
      }
      try {
        ;(this.index as any).add(m.id, doc)
      } catch (err) {
        console.error('[ModSearchIndex] add failed', m.id, err, doc)
      }
    }
  }

  clear(): void {
    ;(this.index as any).clear()
  }

  async search(query: string, limit = 100): Promise<StoredModData[]> {
    const hits = (await (this.index as any).searchAsync(query, limit, {
      enrich: true,
    })) as Array<{ result: Array<{ id: number; doc: StoredModData }> }>

    const seen = new Set<number>()
    const out: StoredModData[] = []

    for (const block of hits) {
      if (!Array.isArray(block.result)) continue
      for (const { id, doc } of block.result) {
        if (seen.has(id)) continue
        seen.add(id)
        out.push(doc)
      }
    }
    return out
  }
}

export const localMapsSearchIndex = new LocalMapsSearchIndex()
export const modioMapsSearchIndex = new ModSearchIndex()
