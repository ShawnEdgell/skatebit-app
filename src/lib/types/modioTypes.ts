export interface ModioUser {
  id: number
  username: string
  profile_url: string
  avatar?: {
    filename?: string
    original?: string
    thumb_100x100?: string
    thumb_50x50?: string
  }
  date_online?: number
}

export interface ModioModfile {
  id: number
  mod_id: number
  date_added: number
  date_scanned: number
  filesize?: number
  filesize_uncompressed?: number
  filename?: string
  version?: string | null
  download: {
    binary_url: string
    date_expires: number
  }
  filehash?: { md5?: string }
}

export interface ModioStats {
  mod_id: number
  popularity_rank_position?: number
  downloads_total?: number
  subscribers_total?: number
  ratings_total?: number
  ratings_positive?: number
  ratings_negative?: number
  ratings_percentage_positive?: number
}

export interface ModioLogo {
  filename?: string
  original?: string
  thumb_1280x720?: string
  thumb_640x360?: string
  thumb_320x180: string
}

export interface ModioTag {
  name: string
}

export interface Mod {
  id: number
  game_id: number
  status: number
  visible: number
  submitted_by?: ModioUser
  date_added: number
  date_updated: number
  date_live: number
  maturity_option?: number
  name: string
  name_id: string
  summary: string
  description?: string
  profile_url: string
  logo: ModioLogo
  modfile?: ModioModfile
  media?: {
    images?: Array<{
      filename: string
      original: string
      thumb_320x180: string
    }>
  }
  metadata_kvp?: Array<{ key: string; value: string }>
  tags?: Array<ModioTag>
  stats?: ModioStats
}
