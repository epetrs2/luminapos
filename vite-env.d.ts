// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};
