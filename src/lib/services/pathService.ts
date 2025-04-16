import { join, documentDir } from "@tauri-apps/api/path";

export const normalizePath = (path: string): string => path.replace(/\\/g, "/");

export async function resolveDocPath(...segments: string[]): Promise<string> {
  return normalizePath(await join(await documentDir(), ...segments));
}

export function getFileName(path: string | null | undefined): string {
  if (!path) return "";
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}
