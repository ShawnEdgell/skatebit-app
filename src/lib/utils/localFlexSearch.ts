// src/lib/utils/localFlexSearch.ts
import { Document } from "flexsearch";
import type { LocalMapEntry } from "$lib/ts/fsOperations";

export class LocalMapsSearchIndex {
  private index: Document;

  constructor() {
    this.index = new Document({
      tokenize: "forward",
      cache: true,
      document: {
        // Use "name" as the unique identifier since LocalMapEntry doesn't have "id"
        id: "name",
        // We'll index the "name" field for searching.
        index: ["name"],
        // Store any fields you need for rendering your UI.
        store: [
          "name",
          "thumbnailPath",
          "thumbnailMimeType",
          "size",
          "isDirectory",
          // Add more fields if needed.
        ],
      },
    });
  }

  add(maps: LocalMapEntry[]): void {
    maps.forEach((map) => {
      // Spread the map object to ensure all properties are included.
      this.index.add({ ...map });
    });
  }

  clear(): void {
    this.index.clear();
  }

  async search(query: string): Promise<LocalMapEntry[]> {
    if (!query.trim()) {
      return [];
    }
    type EnrichedResult = {
      field: string;
      result: Array<{ id: string; doc: LocalMapEntry }>;
    };
    const enrichedResults = (await this.index.searchAsync(query, {
      enrich: true,
    })) as unknown as EnrichedResult[];
    const maps: LocalMapEntry[] = enrichedResults.flatMap((item) =>
      item.result.map((match) => match.doc)
    );
    // Use "name" as the key for deduplication.
    const unique = Array.from(
      new Map(maps.map((map) => [map.name, map])).values()
    );
    return unique;
  }
}

export const localMapsSearchIndex = new LocalMapsSearchIndex();
