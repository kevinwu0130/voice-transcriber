import { defineConfig } from 'vite'

export default defineConfig({
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@xenova/transformers'] },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
