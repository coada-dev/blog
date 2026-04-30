/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly HASHNODE_PUBLICATION_HOST: string;
  readonly HASHNODE_ACCESS_TOKEN: string;
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
