import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  envPrefix: ['VITE_', 'FAL_', 'ELEVENLABS_'],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3333,
    open: true,
  },
})
