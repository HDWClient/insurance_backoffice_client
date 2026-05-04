import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/insurance-backoffice/',
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://10.0.21.159:8008',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/v1/, ''),
        // /api/v1/auth/login/password → http://10.0.21.159:8008/auth/login/password
      },
    },
  },
})
