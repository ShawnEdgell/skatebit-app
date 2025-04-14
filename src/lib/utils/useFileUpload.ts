// src/lib/utils/useFileUpload.ts (or wherever uploadFilesToCurrentPath lives)

import { invoke } from "@tauri-apps/api/core";
import { join, normalize } from "@tauri-apps/api/path"; // Use Tauri path functions
import { normalizePath } from "$lib/ts/pathUtils"; // Assuming normalizePath exists
import { handleError, handleSuccess } from "$lib/ts/errorHandler"; // Assuming these exist

// Removed resolveDocPath import as we now expect absolute path input

export async function uploadFilesToCurrentPath(
  files: FileList | null,
  destinationAbsolutePath: string, // Expect the absolute path of the folder to save into
  onComplete?: () => void
) {
  if (!files || files.length === 0) {
    console.log("No files selected for upload.");
    onComplete?.(); // Still call complete if no files
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
    let targetAbsolutePath: string | null = null; // Define outside try block
    try {
      // Construct the absolute path for the file within the destination folder
      targetAbsolutePath = normalizePath(
        await join(destinationAbsolutePath, file.name)
      );
      if (!targetAbsolutePath)
        throw new Error("Could not construct target path."); // Should not happen

      const buffer = await file.arrayBuffer();
      const fileContents = Array.from(new Uint8Array(buffer)); // Convert to standard array

      console.log(`Invoking save_file for: ${targetAbsolutePath}`);
      // --- FIX INVOKE ARGUMENTS ---
      await invoke("save_file", {
        absolutePath: targetAbsolutePath, // Correct key name
        contents: fileContents,
      });
      // --- END FIX ---
      console.log(`Successfully saved: ${targetAbsolutePath}`);
    } catch (err) {
      errorOccurred = true;
      // Use targetAbsolutePath if available, otherwise just file name
      const errorContext = targetAbsolutePath ? targetAbsolutePath : file.name;
      console.error(`Error saving file "${errorContext}":`, err);
      handleError(err, `Saving file "${file.name}"`);
      // Decide if you want to stop on the first error or continue uploading others
      // break; // Uncomment to stop on first error
    }
  }

  if (!errorOccurred) {
    handleSuccess(`${files.length} file(s) uploaded successfully.`, "Upload");
  } else {
    // Optional: Show a generic error if some files failed
    // toastStore.addToast("Some files failed to upload.", "alert-warning");
  }

  onComplete?.(); // Call completion callback
}
