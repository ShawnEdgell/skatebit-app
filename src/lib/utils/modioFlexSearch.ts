// lib/utils/flexsearch.ts
import { Document } from "flexsearch";
import type { Mod } from "$lib/types/modio";

interface IndexedMod extends Mod {
  tagNames?: string;
  imageUrl?: string;
}

type DocumentData = { [key: string]: any };

export class ModSearchIndex {
  private index: Document;

  constructor() {
    this.index = new Document({
      tokenize: "forward",
      cache: true,
      document: {
        id: "id",
        index: ["name", "summary", "tagNames"],
        store: [
          "id",
          "name",
          "summary",
          "logo",
          "profile_url",
          "modfile",
          "date_added",
          "tags",
          "stats",
          "tagNames",
          "imageUrl",
        ],
      },
    });
  }

  add(mods: Mod[]): void {
    const indexedMods: IndexedMod[] = mods.map((mod) => ({
      ...mod,
      tagNames: mod.tags ? mod.tags.map((tag) => tag.name).join(" ") : "",
      imageUrl: mod.logo?.thumb_320x180,
    }));

    indexedMods.forEach((mod) => {
      const docData: DocumentData = { ...mod };
      this.index.add(docData);
    });
  }

  remove(mod: Mod): void {
    this.index.remove(mod.id);
  }

  clear(): void {
    this.index.clear();
  }

  async search(query: string): Promise<Mod[]> {
    if (!query.trim()) {
      return [];
    }
    // Retrieve enriched results.
    type EnrichedResult = {
      field: string;
      result: Array<{ id: number; doc: Mod }>;
    };
    const enrichedResults = (await this.index.searchAsync(query, {
      enrich: true,
    })) as unknown as EnrichedResult[];
    // Flatten and deduplicate the results.
    const mods: Mod[] = enrichedResults.flatMap((item) =>
      item.result.map((match) => match.doc)
    );
    const unique = Array.from(
      new Map(mods.map((mod) => [mod.id, mod])).values()
    );
    return unique;
  }
}

export const modSearchIndex = new ModSearchIndex();
