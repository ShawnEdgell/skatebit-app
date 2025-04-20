// Interface for the subset of Mod data we will actually store in FlexSearch
export interface StoredModData {
  id: number
  name: string
  summary: string
  profile_url: string
  date_updated: number
  tagNames?: string
  imageUrl?: string
  // Add any other primitive fields from Mod.io to be stored/searchable
  // e.g., game_id: number; date_updated: number;
}

export interface StoredFsEntryData {
  path: string
  name: string
  isDirectory?: boolean
  size?: number
  modified?: number
  thumbnailMimeType?: string
}
