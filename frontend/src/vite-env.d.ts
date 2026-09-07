/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'convert-layout/ru' {
  interface RuLayout {
    fromEn: (text: string) => string;
    toEn: (text: string) => string;
  }

  const ru: RuLayout;
  export default ru;
}
