/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL the Axios instance prefixes onto every request (e.g. "/api"). */
  readonly VITE_API_BASE_URL?: string;
  /** Dev-only: where Vite proxies "/api" to (the running backend). */
  readonly VITE_API_PROXY_TARGET?: string;
  /** Optional dev convenience: pre-fills the "School code" field on the login form. */
  readonly VITE_DEFAULT_SCHOOL_IDENTIFIER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
