// src/lib/types/searchTypes.ts

// Interface for the subset of Mod data we will actually store in FlexSearch
// Only include primitive types or simple arrays compatible with FlexSearch 'add'
export interface StoredModData {
  id: number;
  name: string;
  summary: string;
  profile_url: string;
  date_added: number;
  // derived fields
  tagNames?: string; // Combined tags for searching
  imageUrl?: string; // Simple URL for display
  // Add any other primitive fields from Mod that you need stored/searchable
  // e.g., game_id: number; date_updated: number;
}

// Interface defining the structure of documents stored for FsEntry
// Assuming FsEntry itself only contains compatible types. If not, define StoredFsEntryData.
export interface StoredFsEntryData {
  path: string; // ID field must be present
  name: string;
  isDirectory?: boolean;
  size?: number;
  modified?: number; // Assuming stored as number (timestamp)
  thumbnailPath?: string;
  thumbnailMimeType?: string;
}
