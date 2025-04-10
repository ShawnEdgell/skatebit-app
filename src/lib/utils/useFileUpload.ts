import { invoke } from "@tauri-apps/api/core";
import { resolveDocPath } from "$lib/ts/pathUtils";

export async function uploadFilesToCurrentPath(
  files: FileList | null,
  currentPath: string,
  onComplete?: () => void
) {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    try {
      const buffer = await file.arrayBuffer();
      const absolutePath = await resolveDocPath(currentPath, file.name);
      await invoke("save_file", {
        path: absolutePath,
        contents: Array.from(new Uint8Array(buffer)),
      });
    } catch (err) {
      const fallback = await resolveDocPath(currentPath, file.name);
      console.error(`Save Error for ${file.name} at ${fallback}:`, err);
    }
  }

  onComplete?.();
}
