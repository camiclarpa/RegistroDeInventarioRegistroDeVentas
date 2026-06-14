import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    // Usar esbuild que maneja mejor los exports nombrados
    minify: 'esbuild',
    sourcemap: false,
    // Desactivar tree-shaking agresivo para lucide-react
    rollupOptions: {
      output: {
        manualChunks: {
          'lucide-icons': ['lucide-react'],
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      },
      // Preservar exports nombrados
      preserveEntrySignatures: 'exports-only'
    },
    chunkSizeWarningLimit: 2000
  },
  // Optimizar dependencias para evitar problemas de exports
  optimizeDeps: {
    include: ['lucide-react']
  }
})
