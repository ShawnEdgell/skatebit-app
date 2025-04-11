// src/lib/ts/fsOperations.ts
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

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export interface LocalMapEntry extends TauriDirEntry {
  size?: number;
  thumbnailPath?: string;
  thumbnailMimeType?: string;
  modified?: number;
}

export const baseFolder = "SkaterXL";

const thumbnailExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
const excludedFileExts = [...thumbnailExts, ".dll", ".json"];

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
    const folderPath = normalizePath(mapsFolder);
    const entries = await readDir(folderPath, {
      baseDir: BaseDirectory.Document,
    });

    const thumbnailMap = new Map<string, { path: string; mimeType: string }>();

    for (const entry of entries) {
      if (entry.isDirectory) {
        const folderName = entry.name;
        const key = folderName.toLowerCase();
        const folderEntryPath = normalizePath(
          await join(folderPath, folderName)
        );

        for (const ext of thumbnailExts) {
          const candidateName = `${folderName}${ext}`;
          const candidatePath = normalizePath(
            await join(folderPath, folderName, candidateName)
          );
          try {
            await stat(candidatePath, { baseDir: BaseDirectory.Document });
            const mimeInfo = getMimeTypeFromExtension(candidateName);
            if (mimeInfo) {
              thumbnailMap.set(key, {
                path: candidatePath,
                mimeType: mimeInfo.mime,
              });
              break;
            }
          } catch {}
        }

        if (!thumbnailMap.has(key)) {
          try {
            const subEntries = await readDir(folderEntryPath, {
              baseDir: BaseDirectory.Document,
            });
            for (const subEntry of subEntries) {
              if (!subEntry.isDirectory) {
                const lowerName = subEntry.name.toLowerCase();
                if (thumbnailExts.some((ext) => lowerName.endsWith(ext))) {
                  const path = normalizePath(
                    await join(folderPath, folderName, subEntry.name)
                  );
                  const mimeInfo = getMimeTypeFromExtension(subEntry.name);
                  if (mimeInfo) {
                    thumbnailMap.set(key, {
                      path,
                      mimeType: mimeInfo.mime,
                    });
                    break;
                  }
                }
              }
            }
          } catch {}
        }
      } else {
        const lowerName = entry.name.toLowerCase();
        if (thumbnailExts.some((ext) => lowerName.endsWith(ext))) {
          const mimeInfo = getMimeTypeFromExtension(entry.name);
          if (mimeInfo) {
            const key = entry.name.replace(mimeInfo.ext, "").toLowerCase();
            const path = normalizePath(await join(folderPath, entry.name));
            thumbnailMap.set(key, {
              path,
              mimeType: mimeInfo.mime,
            });
          }
        }
      }
    }

    const filteredEntries = entries.filter(
      (entry) =>
        entry.isDirectory ||
        !excludedFileExts.some((ext) => entry.name.toLowerCase().endsWith(ext))
    );

    const mapEntries = await Promise.all(
      filteredEntries.map(async (entry): Promise<LocalMapEntry> => {
        const enriched: LocalMapEntry = { ...entry };
        const fullPath = normalizePath(await join(folderPath, entry.name));
        try {
          const statInfo = await stat(fullPath, {
            baseDir: BaseDirectory.Document,
          });
          enriched.size = statInfo.size;
          enriched.modified = statInfo.birthtime
            ? new Date(statInfo.birthtime as string | number | Date).getTime()
            : 0;
        } catch {}
        const key = entry.isDirectory
          ? entry.name.toLowerCase()
          : entry.name.replace(/\.[^/.]+$/, "").toLowerCase();

        if (thumbnailMap.has(key)) {
          const { path, mimeType } = thumbnailMap.get(key)!;
          enriched.thumbnailPath = path;
          enriched.thumbnailMimeType = mimeType;
        }

        return enriched;
      })
    );

    return mapEntries;
  } catch (error) {
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

export async function createFolder(
  currentPath: string,
  folderName: string
): Promise<void> {
  try {
    await mkdir(normalizePath(`${currentPath}/${folderName}`), {
      baseDir: BaseDirectory.Document,
    });
  } catch (error) {
    handleError(error, "creating new folder");
  }
}

export async function createFile(
  currentPath: string,
  fileName: string
): Promise<void> {
  try {
    await create(normalizePath(`${currentPath}/${fileName}`), {
      baseDir: BaseDirectory.Document,
    });
  } catch (err) {
    handleError(err, "creating new file");
  }
}

export async function renameEntry(
  currentPath: string,
  oldName: string,
  newName: string
): Promise<void> {
  if (!newName) return;
  try {
    const docDir = await documentDir();
    if (!docDir) throw new Error("Document directory not found");

    const oldAbsPath = normalizePath(await join(docDir, currentPath, oldName));
    const newAbsPath = normalizePath(await join(docDir, currentPath, newName));

    await rename(oldAbsPath, newAbsPath);
  } catch (error) {
    handleError(error, "renaming entry");
  }
}

export async function deleteEntry(
  currentPath: string,
  name: string
): Promise<boolean> {
  try {
    const pathToDelete = await join(currentPath, name);
    await remove(pathToDelete, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    return true;
  } catch (error) {
    handleError(error, "deleting entry");
    throw error;
  }
}
