import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The video-export worker loads the AAC add-on only when a browser needs it
  // (a dynamic import), which needs an ES-module worker.
  worker: { format: 'es' },
})
