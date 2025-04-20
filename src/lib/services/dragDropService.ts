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

// Modified return type
export async function handleDroppedPaths(
  paths: string[],
  currentDestAbsolutePath: string,
): Promise<{ success: number; errors: number }> {
  console.log('handleDroppedPaths called.')
  console.log('Input paths:', paths)
  console.log('Destination path:', currentDestAbsolutePath)

  let successCount = 0
  let errorCount = 0

  if (!currentDestAbsolutePath || currentDestAbsolutePath.trim() === '') {
    handleError(
      `Invalid drop destination: '${currentDestAbsolutePath}'`,
      'File Drop',
    )
    console.error(
      'handleDroppedPaths: Invalid drop destination:',
      currentDestAbsolutePath,
    )
    // Return early with 0 successes, 0 errors (or maybe 1 error?)
    return { success: 0, errors: paths.length || 1 }
  }

  const normalizedDestination = normalizePath(currentDestAbsolutePath)
  console.log('Normalized destination path:', normalizedDestination)

  for (const sourcePath of paths) {
    const normSourcePath = normalizePath(sourcePath)
    console.log(
      `Processing source path: "${sourcePath}", Normalized: "${normSourcePath}"`,
    )
    if (!normSourcePath) {
      console.warn(`Skipping invalid source path format: ${sourcePath}`)
      errorCount++
      continue
    }

    let itemName = 'unknown_item'
    try {
      itemName = await basename(normSourcePath)
      console.log(
        `Determined item name: "${itemName}" for path "${normSourcePath}"`,
      )
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
        const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>`
        progressToastId = toastStore.addToast(
          `${loadingSpinner} Extracting "${itemName}"...`,
          'alert-info',
          0,
        )
        console.log(
          `Invoking 'handle_dropped_zip' with zipPath: "${normSourcePath}" and targetBaseFolder: "${normalizedDestination}"`,
        )

        const result: InstallationResult = await invoke('handle_dropped_zip', {
          zipPath: normSourcePath,
          targetBaseFolder: normalizedDestination,
        })

        console.log('Received result from handle_dropped_zip:', result)
        toastStore.removeToast(progressToastId)
        progressToastId = null

        if (result.success) {
          console.log(`-> ZIP OK: ${result.message}`)
          toastStore.addToast(`✅ Processed "${itemName}"`, 'alert-success')
          successCount++ // Increment success
        } else {
          console.error(`-> ZIP FAIL: ${result.message}`)
          throw new Error(result.message || `Processing failed for ${itemName}`)
        }
      } else {
        console.log(
          `Checking if "${itemName}" is a file or directory using stat.`,
        )
        const info: FileInfo = await stat(normSourcePath)
        console.log(`Stat info for "${itemName}":`, info)

        if (info.isDirectory) {
          console.log(`-> Handling Dir: ${itemName}`)
          const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>`
          progressToastId = toastStore.addToast(
            `${loadingSpinner} Copying directory "${itemName}"...`,
            'alert-info',
            0,
          )
          const targetDirPath = await join(normalizedDestination, itemName)
          console.log(
            `Copying directory from "${normSourcePath}" to "${targetDirPath}"`,
          )
          await copyFolderRecursive(normSourcePath, targetDirPath)
          toastStore.removeToast(progressToastId)
          progressToastId = null
          toastStore.addToast(
            `✅ Copied directory "${itemName}"`,
            'alert-success',
          )
          console.log(`-> Dir copy OK: "${itemName}"`)
          successCount++ // Increment success
        } else if (info.isFile) {
          console.log(`-> Handling File: ${itemName}`)
          const loadingSpinner = `<span class="loading loading-spinner loading-sm mr-2"></span>`
          progressToastId = toastStore.addToast(
            `${loadingSpinner} Copying file "${itemName}"...`,
            'alert-info',
            0,
          )
          const targetFilePath = await join(normalizedDestination, itemName)
          console.log(
            `Copying file from "${normSourcePath}" to "${targetFilePath}"`,
          )
          await copySingleFile(normSourcePath, targetFilePath)
          toastStore.removeToast(progressToastId)
          progressToastId = null
          toastStore.addToast(`✅ Copied file "${itemName}"`, 'alert-success')
          console.log(`-> File copy OK: "${itemName}"`)
          successCount++ // Increment success
        } else {
          console.warn(`-> Skipping unknown type: ${normSourcePath}`)
          toastStore.addToast(
            `Skipped unknown type: "${itemName}"`,
            'alert-warning',
          )
          // Optionally increment errorCount here if skipping is considered an error
          // errorCount++;
        }
      }
    } catch (error: any) {
      toastStore.removeToast(progressToastId)
      progressToastId = null
      errorCount++ // Increment error
      console.error(`-> FAIL item "${itemName}":`, error)
      handleError(error, `processing dropped item: ${itemName}`)
    }
  }

  console.log(
    `Finished processing. Success: ${successCount}, Errors: ${errorCount}`,
  )
  // Log summary messages (optional)
  if (errorCount > 0 && successCount > 0) {
    console.log(`Summary: ${successCount} successful, ${errorCount} failed.`)
  } else if (errorCount > 0 && successCount === 0) {
    console.log(`Summary: All ${errorCount} items failed.`)
  } else if (successCount > 0 && errorCount === 0) {
    console.log(`Summary: All ${successCount} items successful.`)
  } else {
    console.log(`Summary: No items processed or completed.`)
  }

  // Return final counts
  return { success: successCount, errors: errorCount }
}

async function copySingleFile(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  console.log(`copySingleFile: source="${sourcePath}", target="${targetPath}"`)
  const fileName = await basename(sourcePath)
  try {
    const parentDir = await dirname(targetPath)
    console.log(
      `copySingleFile: parent directory for target "${targetPath}" is "${parentDir}"`,
    )
    // Check if parentDir is valid before attempting mkdir
    if (parentDir && parentDir !== sourcePath) {
      // Avoid creating dir if target is same as source parent
      console.log(
        `copySingleFile: Creating parent directory (if needed): "${parentDir}"`,
      )
      await mkdir(parentDir, { recursive: true })
    }
    console.log(
      `copySingleFile: Calling copyFile("${sourcePath}", "${targetPath}")`,
    )
    await copyFile(sourcePath, targetPath)
    console.log(`copySingleFile: copyFile successful for "${fileName}".`)
  } catch (error) {
    console.error(
      ` -> Error copying file "${fileName}" to "${targetPath}":`,
      error,
    )
    throw error // Re-throw error to be caught by handleDroppedPaths
  }
}

async function copyFolderRecursive(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  console.log(
    `copyFolderRecursive: source="${sourcePath}", target="${targetPath}"`,
  )
  const folderName = await basename(sourcePath)
  try {
    console.log(
      `copyFolderRecursive: Creating target directory (if needed): "${targetPath}"`,
    )
    await mkdir(targetPath, { recursive: true })

    console.log(`copyFolderRecursive: Reading directory: "${sourcePath}"`)
    const items: TauriDirEntry[] = await readDir(sourcePath)
    console.log(
      `copyFolderRecursive: Read ${items.length} items from "${sourcePath}"`,
    )

    for (const item of items) {
      const itemName = item.name
      if (!itemName) {
        console.warn(
          `copyFolderRecursive: Skipping item with no name in "${sourcePath}"`,
        )
        continue
      }
      const itemSourcePath = await join(sourcePath, itemName)
      const itemTargetPath = await join(targetPath, itemName)

      console.log(
        `copyFolderRecursive: Processing item "${itemName}". Is directory: ${item.isDirectory}, Is file: ${item.isFile}`,
      )

      // Prioritize provided flags if available
      if (item.isDirectory) {
        await copyFolderRecursive(itemSourcePath, itemTargetPath)
      } else if (item.isFile) {
        await copySingleFile(itemSourcePath, itemTargetPath)
      } else {
        // Fallback to stat if flags are missing/unreliable (optional robustness)
        try {
          console.log(
            `copyFolderRecursive: Item "${itemName}" type unknown/null flags, using stat fallback.`,
          )
          const itemInfo: FileInfo = await stat(itemSourcePath)
          if (itemInfo.isDirectory) {
            await copyFolderRecursive(itemSourcePath, itemTargetPath)
          } else if (itemInfo.isFile) {
            await copySingleFile(itemSourcePath, itemTargetPath)
          } else {
            console.warn(
              `copyFolderRecursive: Skipping item "${itemName}" with unhandled type after stat.`,
            )
          }
        } catch (statError) {
          console.error(
            `copyFolderRecursive: Failed to stat item "${itemName}":`,
            statError,
          )
          // Decide how to handle stat errors, maybe re-throw or just log
          handleError(statError, `processing item in folder copy: ${itemName}`)
        }
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
    throw error // Re-throw error to be caught by handleDroppedPaths
  }
}
