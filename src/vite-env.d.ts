/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PLATFORM: 'web' | 'android';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __SENTRY_DSN__: string;
