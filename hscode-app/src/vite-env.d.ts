/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATOR?: string
}
interface Window {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
}
declare var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
interface ImportMeta {
  readonly env: ImportMetaEnv
}
