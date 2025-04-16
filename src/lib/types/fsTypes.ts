// src/lib/types/fsTypes.ts
export enum ListingStatus {
  ExistsAndPopulated = "existsAndPopulated",
  ExistsAndEmpty = "existsAndEmpty",
  DoesNotExist = "doesNotExist",
}

export interface FsEntry {
  name: string | null;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modified: number | null;
  thumbnailPath: string | null;
  thumbnailMimeType: string | null;
}

export interface DirectoryListingResult {
  status: ListingStatus;
  entries: FsEntry[];
  path: string;
}
