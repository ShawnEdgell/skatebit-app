// src/lib/utils/useFileUpload.ts

import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { normalizePath } from "$lib/services/pathService";
import { handleError, handleSuccess } from "$lib/utils/errorHandler";
import { toastStore } from "$lib/stores/uiStore";

export async function uploadFilesToCurrentPath(
  files: FileList | null,
  destinationAbsolutePath: string,
  onComplete?: () => void
) {
  if (!files || files.length === 0) {
    console.log("No files selected for upload.");
    onComplete?.();
    return;
  }
  if (!destinationAbsolutePath) {
    handleError("Cannot upload: Destination path is missing.", "Upload");
    onComplete?.();
    return;
  }

  console.log(
    `Attempting to upload ${files.length} file(s) to: ${destinationAbsolutePath}`
  );
  let errorOccurred = false;

  // Process files sequentially to avoid overwhelming backend or getting mixed error messages
  for (const file of Array.from(files)) {
    let targetAbsolutePath: string | null = null;
    try {
      // Construct the absolute path for the file within the destination folder
      targetAbsolutePath = normalizePath(
        await join(destinationAbsolutePath, file.name)
      );
      if (!targetAbsolutePath)
        throw new Error("Could not construct target path.");

      const buffer = await file.arrayBuffer();
      const fileContents = Array.from(new Uint8Array(buffer));

      console.log(`Invoking save_file for: ${targetAbsolutePath}`);
      await invoke("save_file", {
        absolutePath: targetAbsolutePath,
        contents: fileContents,
      });
      console.log(`Successfully saved: ${targetAbsolutePath}`);
    } catch (err) {
      errorOccurred = true;
      // Use targetAbsolutePath if available, otherwise just file name
      const errorContext = targetAbsolutePath ? targetAbsolutePath : file.name;
      console.error(`Error saving file "${errorContext}":`, err);
      handleError(err, `Saving file "${file.name}"`);
    }
  }

  if (!errorOccurred) {
    handleSuccess(`${files.length} file(s) uploaded successfully.`, "Upload");
  } else {
    toastStore.addToast("Some files failed to upload.", "alert-warning");
  }
  onComplete?.();
}
