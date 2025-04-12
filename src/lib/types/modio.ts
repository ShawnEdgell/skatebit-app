// src/lib/types/modio.ts (or similar file name)

// Define the nested User structure based on the example data
interface ModioUser {
  id: number;
  username: string; // This is the author's name we want
  profile_url: string;
  // Add other fields from the example if needed, e.g., avatar
  avatar?: {
    filename?: string;
    original?: string;
    thumb_100x100?: string;
    thumb_50x50?: string;
  };
  date_online?: number;
  // Add other fields like name_id, date_joined etc. if required
}

// Define the nested Modfile structure
interface ModioModfile {
  id: number;
  mod_id: number;
  date_added: number;
  date_scanned: number;
  filesize?: number; // Keep optional as before
  filesize_uncompressed?: number; // Keep optional
  filename?: string; // Keep optional
  version?: string | null; // Can be null
  download: {
    binary_url: string;
    date_expires: number;
  };
  filehash?: {
    // Optional filehash object
    md5?: string;
  };
  // Add other modfile fields if needed (e.g., virus scan status)
}

// Define the nested Stats structure
interface ModioStats {
  mod_id: number;
  popularity_rank_position?: number;
  popularity_rank_total_mods?: number;
  downloads_total?: number;
  subscribers_total?: number;
  ratings_total?: number;
  ratings_positive?: number;
  ratings_negative?: number;
  ratings_percentage_positive?: number;
  ratings_weighted_aggregate?: number;
  ratings_display_text?: string;
  date_expires?: number;
  // Add other stats fields if needed
}

// Define the nested Logo structure
interface ModioLogo {
  filename?: string;
  original?: string;
  thumb_1280x720?: string;
  thumb_640x360?: string;
  thumb_320x180: string; // Assuming this is always present
}

// Define the nested Tag structure
interface ModioTag {
  name: string;
  // Add other tag fields if needed (date_added, etc.)
}

// Main Mod interface
export interface Mod {
  id: number;
  game_id: number; // From example
  status: number; // From example
  visible: number; // From example
  submitted_by?: ModioUser; // *** ADDED: Nested user object (optional) ***
  date_added: number; // Unix timestamp (seconds)
  date_updated: number; // From example
  date_live: number; // From example
  maturity_option?: number; // From example
  name: string;
  name_id: string; // From example
  summary: string;
  description?: string; // From example (optional)
  description_plaintext?: string; // From example (optional)
  metadata_blob?: string | null; // From example
  profile_url: string;
  logo: ModioLogo; // Use nested interface
  modfile?: ModioModfile; // Use nested interface (make optional if a mod might not have a file yet)
  media?: {
    // From example
    // Define youtube, sketchfab, images arrays if needed
    images?: Array<{
      /* define image object structure */
    }>;
  };
  metadata_kvp?: Array<{
    /* define kvp structure */
  }>; // From example
  tags?: Array<ModioTag>; // Use nested interface
  stats?: ModioStats; // Use nested interface
  // Add other top-level fields from example if needed (price, stock, etc.)
}
