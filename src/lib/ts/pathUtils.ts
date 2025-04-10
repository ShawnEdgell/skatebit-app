// src/lib/ts/pathUtils.ts

/**
 * Normalizes a file path to consistently use forward slashes.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Extracts the file or folder name from a path.
 */
export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? "";
}

/**
 * Resolves a document-relative absolute path from segments.
 */
import { join, documentDir } from "@tauri-apps/api/path";
export async function resolveDocPath(...segments: string[]): Promise<string> {
  const docDir = await documentDir();
  return await join(docDir, ...segments);
}
