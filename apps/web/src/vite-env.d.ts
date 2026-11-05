/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  /** Browser-safe publishable key. Never a service-role or sb_secret_ key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Base URL of the Go Core API (for example http://localhost:8080). */
  readonly VITE_CORE_API_URL?: string;
}

interface Window {
  /** Optional runtime config loaded from /config.js, so Pages deploys can change the API URL without a rebuild. */
  FRIKHII_CONFIG?: {
    coreApiUrl?: string;
  };
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
