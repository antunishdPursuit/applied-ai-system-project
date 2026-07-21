import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep stable framework code cacheable without masking future bundle growth.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/examples/')) return 'three-extras'
          if (id.includes('/node_modules/three/')) return 'three'
          if (id.includes('/node_modules/@pixiv/')) return 'vrm'
          if (id.includes('/node_modules/react') || id.includes('/node_modules/scheduler/')) return 'react'
        },
      },
    },
  },
})
