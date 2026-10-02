import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const apiEnabled = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_ENABLED === 'true'
  return {
    base: mode === 'production' && !apiEnabled ? '/letopis-history-learning-public/' : '/',
    plugins: [react()],
    server: { proxy: { '/api': 'http://localhost:3001' } },
    build: {
      chunkSizeWarningLimit: 520,
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  }
})
