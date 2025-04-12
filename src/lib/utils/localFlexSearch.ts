// src/lib/utils/localFlexSearch.ts
import FlexSearch from "flexsearch";
import type { FsEntry } from "$lib/ts/fsOperations";

interface StoredMapDocument {
  name: string | null;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modified: number | null;
  thumbnailPath: string | null;
  thumbnailMimeType: string | null;
  relativeThumbnailPath: string | null;
}

export class LocalMapsSearchIndex {
  private index: any; // Keep as 'any' for now

  constructor() {
    // Instantiate WITHOUT generics in the constructor call
    this.index = new FlexSearch.Document({
      tokenize: "forward",
      cache: true,
      document: {
        id: "path",
        index: ["name"],
        store: [
          "name",
          "path",
          "isDirectory",
          "size",
          "modified",
          "thumbnailPath",
          "thumbnailMimeType",
          "relativeThumbnailPath",
        ],
      },
    });
  }

  add(maps: FsEntry[]): void {
    maps.forEach((map) => {
      if (map.path) {
        this.index.add(map);
      } else {
        console.warn(
          "Skipping map entry in FlexSearch add due to missing path:",
          map
        );
      }
    });
  }

  clear(): void {
    this.index.clear();
  }

  async search(query: string): Promise<FsEntry[]> {
    if (!query.trim()) {
      return [];
    }

    type SearchResultUnit = {
      id: string;
      doc: StoredMapDocument;
    };
    type SearchResultField = {
      field: string;
      result: SearchResultUnit[];
    };

    try {
      const searchResults = await this.index.searchAsync(query, {
        limit: 100,
        enrich: true,
        bool: "or",
      });

      let finalDocs: StoredMapDocument[] = [];

      if (searchResults && searchResults.length > 0) {
        if ("field" in searchResults[0] && "result" in searchResults[0]) {
          const groupedResults = searchResults as SearchResultField[];
          finalDocs = groupedResults.flatMap((fieldResult) =>
            fieldResult.result.map((unit) => unit.doc)
          );
        } else if ("id" in searchResults[0] && "doc" in searchResults[0]) {
          const flatResults = searchResults as SearchResultUnit[];
          finalDocs = flatResults.map((unit) => unit.doc);
        } else {
          console.warn(
            "Unexpected FlexSearch result structure:",
            searchResults
          );
        }
      }

      const uniqueDocs = Array.from(
        new Map(finalDocs.map((doc) => [doc.path, doc])).values()
      );

      return uniqueDocs as FsEntry[];
    } catch (error) {
      console.error("FlexSearch search error:", error);
      return [];
    }
  }
}

export const localMapsSearchIndex = new LocalMapsSearchIndex();
