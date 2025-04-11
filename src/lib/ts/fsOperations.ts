import { join, documentDir } from "@tauri-apps/api/path";
import {
  readDir,
  stat,
  BaseDirectory,
  create,
  mkdir,
  rename,
  remove,
  type DirEntry as TauriDirEntry,
} from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";
import { normalizePath } from "./pathUtils";
import { toastStore } from "$lib/stores/toastStore";

export interface LocalMapEntry extends TauriDirEntry {
  size?: number;
  thumbnailPath?: string;
  thumbnailMimeType?: string;
  modified?: number;
}

export const baseFolder = "SkaterXL";

const getMimeTypeFromExtension = (
  filePath: string
): { mime: string; ext: string } | undefined => {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (!extension) return undefined;
  const mimeMap: Record<string, { mime: string; ext: string }> = {
    png: { mime: "image/png", ext: ".png" },
    jpg: { mime: "image/jpeg", ext: ".jpg" },
    jpeg: { mime: "image/jpeg", ext: ".jpeg" },
    gif: { mime: "image/gif", ext: ".gif" },
    webp: { mime: "image/webp", ext: ".webp" },
    bmp: { mime: "image/bmp", ext: ".bmp" },
  };
  return mimeMap[extension];
};

export async function loadLocalMapsSimple(
  mapsFolder: string
): Promise<LocalMapEntry[]> {
  try {
    const entries = await readDir(mapsFolder, {
      baseDir: BaseDirectory.Document,
    });

    const imageExts: string[] = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".bmp",
      ".dll",
      ".json",
    ];
    const thumbnailMap = new Map<string, { path: string; mimeType: string }>();

    for (const entry of entries) {
      if (!entry.isDirectory) {
        const lowerName = entry.name.toLowerCase();
        if (imageExts.some((ext) => lowerName.endsWith(ext))) {
          const entryRelativePath = normalizePath(
            await join(mapsFolder, entry.name)
          );
          const mimeInfo = getMimeTypeFromExtension(entry.name);
          if (mimeInfo) {
            const key = entry.name
              .substring(0, entry.name.length - mimeInfo.ext.length)
              .toLowerCase();
            if (!thumbnailMap.has(key)) {
              thumbnailMap.set(key, {
                path: entryRelativePath,
                mimeType: mimeInfo.mime,
              });
            }
          }
        }
      } else {
        const folderName = entry.name;
        const key = folderName.toLowerCase();
        if (thumbnailMap.has(key)) continue;
        let thumbnailFound = false;
        const folderPath = normalizePath(await join(mapsFolder, folderName));
        for (const ext of imageExts) {
          const candidateName = `${folderName}${ext}`;
          const candidatePath = normalizePath(
            await join(mapsFolder, folderName, candidateName)
          );
          try {
            await stat(candidatePath, { baseDir: BaseDirectory.Document });
            const mimeInfo = getMimeTypeFromExtension(candidateName);
            if (mimeInfo) {
              thumbnailMap.set(key, {
                path: candidatePath,
                mimeType: mimeInfo.mime,
              });
              thumbnailFound = true;
              break;
            }
          } catch {}
        }
        if (!thumbnailFound) {
          try {
            const subEntries = await readDir(folderPath, {
              baseDir: BaseDirectory.Document,
            });
            for (const subEntry of subEntries) {
              if (!subEntry.isDirectory) {
                const lowerSubName = subEntry.name.toLowerCase();
                if (imageExts.some((ext) => lowerSubName.endsWith(ext))) {
                  const candidatePath = normalizePath(
                    await join(mapsFolder, folderName, subEntry.name)
                  );
                  const mimeInfo = getMimeTypeFromExtension(subEntry.name);
                  if (mimeInfo) {
                    thumbnailMap.set(key, {
                      path: candidatePath,
                      mimeType: mimeInfo.mime,
                    });
                    thumbnailFound = true;
                    break;
                  }
                }
              }
            }
          } catch {}
        }
      }
    }

    const mapEntriesPromises = entries
      .filter(
        (entry) =>
          entry.isDirectory ||
          !imageExts.some((ext) => entry.name.toLowerCase().endsWith(ext))
      )
      .map(async (entry): Promise<LocalMapEntry> => {
        const enriched: LocalMapEntry = { ...entry };
        let lookupName = "";
        const entryFullPath = normalizePath(await join(mapsFolder, entry.name));
        try {
          const inferredStatInfo = await stat(entryFullPath, {
            baseDir: BaseDirectory.Document,
          });
          const getMs = (time: Date | number | null | undefined): number => {
            if (!time) return 0;
            return time instanceof Date
              ? time.getTime()
              : new Date(time).getTime();
          };
          // Instead of using modTime or atime, use birthtime exclusively
          const birthTime = getMs(inferredStatInfo.birthtime);
          enriched.modified = birthTime;
          enriched.size = inferredStatInfo.size;
          enriched.isDirectory = entry.isDirectory;
          if (!entry.isDirectory) {
            const lastDot = entry.name.lastIndexOf(".");
            lookupName =
              lastDot > 0
                ? entry.name.substring(0, lastDot).toLowerCase()
                : entry.name.toLowerCase();
          } else {
            lookupName = entry.name.toLowerCase();
          }
        } catch (e) {
          console.error(
            `[fsOps Pass 2] Error getting stat for ${entryFullPath}:`,
            e
          );
          enriched.modified = 0;
          enriched.isDirectory = entry.isDirectory;
          if (!entry.isDirectory) {
            const lastDot = entry.name.lastIndexOf(".");
            lookupName =
              lastDot > 0
                ? entry.name.substring(0, lastDot).toLowerCase()
                : entry.name.toLowerCase();
          } else {
            lookupName = entry.name.toLowerCase();
          }
        }
        if (thumbnailMap.has(lookupName)) {
          const thumbData = thumbnailMap.get(lookupName)!;
          enriched.thumbnailPath = thumbData.path;
          enriched.thumbnailMimeType = thumbData.mimeType;
        }
        return enriched;
      });

    const finalMapEntries = await Promise.all(mapEntriesPromises);
    return finalMapEntries;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("path does not exist")
    ) {
      console.warn(
        `[fsOps] Maps directory "${mapsFolder}" not found. Returning empty list.`
      );
      return [];
    }
    console.error("[fsOps] Error in loadLocalMapsSimple:", error);
    handleError(error, `loading local maps from ${mapsFolder}`);
    return [];
  }
}

export async function loadEntries(
  currentPath: string
): Promise<(TauriDirEntry & { size?: number })[]> {
  try {
    const entries = await readDir(currentPath, {
      baseDir: BaseDirectory.Document,
    });
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory) {
          try {
            const filePath = await join(currentPath, entry.name);
            const statInfo = await stat(filePath, {
              baseDir: BaseDirectory.Document,
            });
            return { ...entry, size: statInfo.size };
          } catch (e) {
            console.error("Error retrieving stat for", entry.name, e);
          }
        }
        return entry;
      })
    );
    return enriched.sort((a, b) =>
      a.isDirectory === b.isDirectory
        ? a.name.localeCompare(b.name)
        : a.isDirectory
        ? -1
        : 1
    );
  } catch (error) {
    handleError(error, "reading directory");
    return [];
  }
}

export const openDirectory = async (
  currentPath: string,
  dirName: string
): Promise<string> => normalizePath(`${currentPath}/${dirName}`);

export const goUp = async (currentPath: string): Promise<string> => {
  const norm = normalizePath(currentPath);
  return norm === baseFolder ? norm : norm.split("/").slice(0, -1).join("/");
};

export async function promptNewFolder(currentPath: string): Promise<void> {
  const folderName = prompt("Enter new folder name:");
  if (folderName) {
    try {
      await mkdir(normalizePath(`${currentPath}/${folderName}`), {
        baseDir: BaseDirectory.Document,
      });
      toastStore.addToast(
        `Folder "${folderName}" created successfully`,
        "alert-success",
        3000
      );
    } catch (error) {
      handleError(error, "creating new folder");
    }
  }
}

export async function promptNewFile(currentPath: string): Promise<void> {
  const fileName = prompt("Enter new file name:");
  if (fileName) {
    try {
      await create(normalizePath(`${currentPath}/${fileName}`), {
        baseDir: BaseDirectory.Document,
      });
      toastStore.addToast(
        `File "${fileName}" created successfully`,
        "alert-success",
        3000
      );
    } catch (err) {
      handleError(err, "creating new file");
    }
  }
}

export async function renameEntry(
  currentPath: string,
  oldName: string
): Promise<void> {
  const newEntryName = prompt("New name:", oldName);
  if (!newEntryName) return;
  try {
    // Get the document directory (allowed base folder)
    const docDir = await documentDir();
    if (!docDir) throw new Error("Document directory not found");

    // Build absolute paths using documentDir, currentPath, and filenames.
    const oldAbsPath = normalizePath(await join(docDir, currentPath, oldName));
    const newAbsPath = normalizePath(
      await join(docDir, currentPath, newEntryName)
    );

    // Perform the rename operation using the absolute paths.
    await rename(oldAbsPath, newAbsPath);

    toastStore.addToast(
      `Entry renamed successfully to "${newEntryName}"`,
      "alert-info",
      3000
    );
  } catch (error) {
    handleError(error, "renaming entry");
  }
}

export async function deleteEntry(
  currentPath: string,
  name: string
): Promise<boolean> {
  if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return false;
  try {
    const pathToDelete = await join(currentPath, name);
    await remove(pathToDelete, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    toastStore.addToast(
      `Entry "${name}" deleted successfully`,
      "alert-warning",
      3000
    );
    return true;
  } catch (error) {
    handleError(error, "deleting entry");
    throw error;
  }
}
