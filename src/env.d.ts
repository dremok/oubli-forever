/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly FAL_KEY: string
  readonly ELEVENLABS_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
