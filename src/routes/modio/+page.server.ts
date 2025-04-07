// src/routes/modio/+page.server.ts
import type { Mod } from "$lib/types/modio";
import { db } from "$lib/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

export const load = async (): Promise<{ mapMods: Mod[] }> => {
  try {
    // Read the first page of cached mods from Firestore
    const docRef = doc(db, "mods", "page_1");
    const snapshot = await getDoc(docRef);
    let mapMods: Mod[] = [];
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.mods) {
        mapMods = data.mods;
      }
    }
    return { mapMods };
  } catch (error) {
    console.error("Error fetching cached mods:", error);
    return { mapMods: [] };
  }
};
