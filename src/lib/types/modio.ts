export interface Mod {
  id: number;
  name: string;
  summary: string;
  logo: { thumb_320x180: string };
  profile_url: string;
  modfile: {
    download: { binary_url: string };
    // Add an optional filesize in bytes:
    filesize?: number;
    // Optionally, you can also store the uncompressed size or filename if needed:
    filesize_uncompressed?: number;
    filename?: string;
  };
  date_added: number;
  tags?: Array<{ name: string }>;
  stats?: {
    date_expires?: number;
    downloads_today?: number;
    downloads_total?: number;
    downloads_unique?: number;
    mod_id?: number;
    popularity_rank_position?: number;
    popularity_rank_total_mods?: number;
    ratings_display_text?: string;
    ratings_negative?: number;
    ratings_percentage_positive?: number;
    ratings_positive?: number;
    ratings_total?: number;
    ratings_weighted_aggregate?: number;
    subscribers_total?: number;
  };
}
