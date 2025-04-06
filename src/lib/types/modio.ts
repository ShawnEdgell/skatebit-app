export interface Mod {
  id: number;
  name: string;
  summary: string;
  logo: { thumb_320x180: string };
  profile_url: string;
  modfile: { download: { binary_url: string } };
  date_added: number;
  tags?: Array<{ name: string }>;
}

export interface ModsData {
  gearMods: Mod[];
  mapMods: Mod[];
  scriptMods: Mod[];
}
