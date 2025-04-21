// ── subset of FS entry fields we actually store in FlexSearch ──
export interface StoredFsEntryData {
  path: string
  name: string
  isDirectory: boolean
  size: number | null
  modified: number | null
  thumbnailPath: string | null
  thumbnailMimeType: string | null
}

// ── subset of Mod fields we actually store in FlexSearch ──
export interface StoredModData {
  id: number
  name: string
  summary: string
  profile_url: string
  date_updated: number
  tagNames: string
  imageUrl: string | null
}
