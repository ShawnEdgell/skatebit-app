import { invoke } from '@tauri-apps/api/core'
import { join, basename, dirname } from '@tauri-apps/api/path'
import {
  readDir,
  mkdir,
  stat,
  copyFile,
  type DirEntry as TauriDirEntry,
  type FileInfo,
} from '@tauri-apps/plugin-fs'
import { handleError } from '$lib/utils/errorHandler'
import { toastStore } from '$lib/stores/uiStore'
import { normalizePath } from '$lib/services/pathService'

interface InstallationResult {
  success: boolean
  message: string
  final_path?: string
  source: string
}

export async function handleDroppedPaths(
  paths: string[],
  currentDestAbsolutePath: string,
): Promise<void> {
  let successCount = 0
  let errorCount = 0
  if (!currentDestAbsolutePath || currentDestAbsolutePath.trim() === '') {
    handleError(
      `Invalid drop destination: '${currentDestAbsolutePath}'`,
      'File Drop',
    )
    return
  }
  const normalizedDestination = normalizePath(currentDestAbsolutePath)

  for (const sourcePath of paths) {
    const normSourcePath = normalizePath(sourcePath)
    if (!normSourcePath) {
      console.warn(`Skipping invalid source path format: ${sourcePath}`)
      errorCount++
      continue
    }
    let itemName = 'unknown_item'
    try {
      itemName = await basename(normSourcePath)
      if (!itemName) throw new Error('Basename empty')
    } catch (e) {
      console.error(`Failed get basename for '${normSourcePath}':`, e)
      handleError(e, `determining name for ${normSourcePath}`)
      errorCount++
      continue
    }

    console.log(`Processing dropped item: ${itemName} (${normSourcePath})`)
    let progressToastId: number | null = null

    try {
      if (itemName.toLowerCase().endsWith('.zip')) {
        console.log(`-> Handling ZIP: ${itemName}`)
        // --- Use Spinner, placed BEFORE text ---
        const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>` // Use spinner, add margin-right
        progressToastId = toastStore.addToast(
          `${loadingSpinner} Extracting "${itemName}"...`, // Spinner first
          'alert-info',
          0, // Indefinite duration
        )
        // ---------------------------------------
        const result: InstallationResult = await invoke('handle_dropped_zip', {
          zipPath: normSourcePath,
          targetBaseFolder: normalizedDestination,
        })
        toastStore.removeToast(progressToastId)
        progressToastId = null
        if (result.success) {
          console.log(`-> ZIP OK: ${result.message}`)
          toastStore.addToast(`✅ Processed "${itemName}"`, 'alert-success')
          successCount++
        } else {
          console.error(`-> ZIP FAIL: ${result.message}`)
          throw new Error(result.message || `Processing failed for ${itemName}`)
        }
      } else {
        const info: FileInfo = await stat(normSourcePath)
        if (info.isDirectory) {
          console.log(`-> Handling Dir: ${itemName}`)
          // --- Use Spinner for Directory Copy ---
          const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>`
          progressToastId = toastStore.addToast(
            `${loadingSpinner} Copying directory "${itemName}"...`, // Spinner first
            'alert-info',
            0,
          )
          // --------------------------------------
          const targetDirPath = await join(normalizedDestination, itemName)
          await copyFolderRecursive(normSourcePath, targetDirPath)
          toastStore.removeToast(progressToastId)
          progressToastId = null
          toastStore.addToast(
            `✅ Copied directory "${itemName}"`,
            'alert-success',
          )
          console.log(`-> Dir copy OK: "${itemName}"`)
          successCount++
        } else if (info.isFile) {
          console.log(`-> Handling File: ${itemName}`)
          // --- Use Spinner for File Copy ---
          const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>`
          progressToastId = toastStore.addToast(
            `${loadingSpinner} Copying file "${itemName}"...`, // Spinner first
            'alert-info',
            0,
          )
          // ---------------------------------
          const targetFilePath = await join(normalizedDestination, itemName)
          await copySingleFile(normSourcePath, targetFilePath)
          toastStore.removeToast(progressToastId)
          progressToastId = null
          toastStore.addToast(`✅ Copied file "${itemName}"`, 'alert-success')
          console.log(`-> File copy OK: "${itemName}"`)
          successCount++
        } else {
          console.warn(`-> Skipping unknown type: ${normSourcePath}`)
          toastStore.addToast(
            `Skipped unknown type: "${itemName}"`,
            'alert-warning',
          )
        }
      }
    } catch (error: any) {
      toastStore.removeToast(progressToastId)
      progressToastId = null
      errorCount++
      console.error(`-> FAIL item "${itemName}":`, error)
      handleError(error, `processing dropped item: ${itemName}`)
    }
  }

  // --- Final Summary Toasts ---
  if (errorCount > 0 && successCount > 0) {
    /* ... */
  } else if (errorCount > 0 && successCount === 0) {
    /* ... */
  } else if (successCount > 0 && errorCount === 0) {
    /* ... */
  } else {
    /* ... */
  }
}

// --- copySingleFile ---
async function copySingleFile(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  // ... (no changes needed here for toast content) ...
  const fileName = await basename(sourcePath)
  try {
    const parentDir = await dirname(targetPath)
    const isRoot = parentDir === '/' || /^[a-zA-Z]:[\\/]?$/.test(parentDir)
    if (!isRoot) {
      await mkdir(parentDir, { recursive: true })
    }
    await copyFile(sourcePath, targetPath)
    console.log(` -> Copied file "${fileName}" to "${targetPath}"`)
  } catch (error) {
    console.error(
      ` -> Error copying file "${fileName}" to "${targetPath}":`,
      error,
    )
    throw error
  }
}

// --- copyFolderRecursive ---
async function copyFolderRecursive(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  // ... (no changes needed here for toast content) ...
  const folderName = await basename(sourcePath)
  try {
    await mkdir(targetPath, { recursive: true })
    const items: TauriDirEntry[] = await readDir(sourcePath)
    for (const item of items) {
      const itemName = item.name
      if (!itemName) {
        /* ... skip ... */ continue
      }
      const itemSourcePath = await join(sourcePath, itemName)
      const itemTargetPath = await join(targetPath, itemName)
      if (item.isDirectory) {
        await copyFolderRecursive(itemSourcePath, itemTargetPath)
      } else if (item.isFile) {
        await copySingleFile(itemSourcePath, itemTargetPath)
      } else {
        /* ... stat fallback ... */
      }
    }
    console.log(
      ` -> Copied contents of folder "${folderName}" to "${targetPath}"`,
    )
  } catch (error) {
    console.error(
      ` -> Error copying folder "${folderName}" to "${targetPath}":`,
      error,
    )
    throw error
  }
}

// Ensure normalizePath is defined, e.g.:
// function normalizePath(path: string): string { return path.replace(/\\/g, '/'); }
