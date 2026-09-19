/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL the Axios instance prefixes onto every request (e.g. "/api"). */
  readonly VITE_API_BASE_URL?: string;
  /** Dev-only: where Vite proxies "/api" to (the running backend). */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
