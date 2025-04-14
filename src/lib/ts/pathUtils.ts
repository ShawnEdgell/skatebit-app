import { join, documentDir } from "@tauri-apps/api/path";

/**
 * Normalizes a file path to consistently use forward slashes.
 * Handles null/undefined inputs gracefully.
 */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/\\/g, "/");
}

/**
 * Extracts the file or folder name from a path.
 */
export function getFileName(path: string): string {
  return normalizePath(path).split("/").pop() ?? "";
}

/**
 * Resolves a document-relative absolute path from segments.
 * Deprecated if most operations use absolute paths. Keep if needed.
 */
export async function resolveDocPath(...segments: string[]): Promise<string> {
  const docDir = await documentDir();
  // Use normalizePath here for consistency if desired
  return normalizePath(await join(docDir, ...segments));
}
