import { getDoc } from "firebase/firestore";
import type { Mod } from "$lib/types/modio";

export async function getFirestoreData(docRef: any): Promise<any> {
  try {
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return snapshot.data();
    }
  } catch (error) {
    console.error("Error getting Firestore data:", error);
  }
  return {};
}

export function filterConsoleMods(mod: Mod): boolean {
  const text = `${(mod.name || "").toLowerCase()} ${(
    mod.summary || ""
  ).toLowerCase()}`;
  return !/(ps4|playstation|xbox)/i.test(text);
}
