import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path";

export async function updateMapsSymlink(newFolder: string) {
  try {
    const docDir = await documentDir();
    if (!docDir) throw new Error("Could not determine Documents directory.");
    // Build the target link: Documents/SkaterXL/Maps
    const targetLink = await join(docDir, "SkaterXL", "Maps");
    // Use camelCase keys so that Tauri converts them properly.
    await invoke("create_maps_symlink", {
      newFolder: newFolder,
      targetLink: targetLink,
    });
    console.log("Symbolic link updated successfully.");
  } catch (error) {
    console.error("Error updating symlink:", error);
    throw error;
  }
}
