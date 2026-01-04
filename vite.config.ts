import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/s3-proxy': {
        target: 'https://pacs-images-dev.s3.ap-south-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/s3-proxy/, ''),
        secure: true,
      },
    },
    fs: {
      allow: ['..'],
    },
  },

  optimizeDeps: {
    include: ['@kitware/vtk.js', 'globalthis', 'dicom-parser'],
  },

  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    target: 'esnext',
  },

  worker: {
    format: 'es',
  },

  define: {
    'process.env': {},
    global: 'globalThis',
  },

  assetsInclude: ['**/*.wasm'],
})
