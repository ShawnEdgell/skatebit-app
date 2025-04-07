import { db } from "$lib/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { fetchMapMods } from "./modio";
import { API_PAGE_SIZE } from "./constants";

const GAME_ID = "629";
const MODIO_API_KEY = import.meta.env.MODIO_API_KEY;

export async function cacheAllMapModsToFirestore() {
  let allMods = [];
  let offset = 0;
  let page = 1;

  while (true) {
    let mods;
    try {
      mods = await fetchMapMods(MODIO_API_KEY, GAME_ID, API_PAGE_SIZE, offset);
    } catch (error) {
      console.error("Error fetching mods at offset", offset, error);
      break;
    }

    if (!mods || mods.length === 0) {
      console.log("No mods returned, stopping.");
      break;
    }

    console.log(`Fetched ${mods.length} mods (offset: ${offset})`);

    try {
      await setDoc(doc(db, "mods", `page_${page}`), {
        mods,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error("Error writing page", page, error);
      break;
    }

    allMods.push(...mods);
    // If fewer mods were returned than requested, this is the final page.
    if (mods.length < API_PAGE_SIZE) {
      console.log("Final page reached.");
      break;
    }

    offset += API_PAGE_SIZE;
    page += 1;
  }

  console.log(`✅ Cached ${allMods.length} mods across ${page} pages.`);
}
