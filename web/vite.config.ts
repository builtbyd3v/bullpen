import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // campus/campus.json lives at the repo root, outside web/.
  server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
})
