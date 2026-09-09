import { defineConfig } from 'vite'
import { resolve } from 'path'

const __dirname = import.meta.dirname

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main:          resolve(__dirname, 'index.html'),
        admin:         resolve(__dirname, 'admin.html'),
        product:       resolve(__dirname, 'product.html'),
        suivi:         resolve(__dirname, 'suivi.html'),
      }
    }
  }
})
