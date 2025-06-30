import { invoke } from '@tauri-apps/api/core';
import { join, documentDir } from '@tauri-apps/api/path';
import { handleError } from '$lib/utils/errorHandler';

export const normalizePath = (path: string): string => path.replace(/\\/g, '/');

export async function resolveDocPath(...segments: string[]): Promise<string> {
  return normalizePath(await join(await documentDir(), ...segments));
}

export async function findSkaterXlPath(): Promise<string | null> {
  try {
    const path = await invoke<string | null>('find_skaterxl_user_data_path');
    if (path) {
      return normalizePath(path);
    }
  } catch (err) {
    handleError(err, 'Finding Skater XL default path');
  }
  return null;
}

export function getFileName(path: string | null | undefined): string {
  if (!path) return '';
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}
