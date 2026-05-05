import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // In QA mode the full API URL is injected via VITE_API_BASE_URL, so
  // Axios calls the QA server directly — no proxy needed. The proxy is
  // only used in development where VITE_API_BASE_URL is a relative path.
  const proxyConfig =
    mode === 'development'
      ? {
          '/api/v1': {
            target: 'https://kinkoboapi.qapfgames.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/v1/, ''),
          },
        }
      : {}

  return {
    plugins: [react()],
    base: '/insurance-backoffice/',
    server: {
      proxy: proxyConfig,
    },
  }
})
