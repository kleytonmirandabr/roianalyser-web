import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget = (
    env.VITE_API_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    'http://localhost:3030'
  ).replace(/\/+$/, '')

  // Base path do app (útil para deploy em sub-path como `/v2/`).
  // Em dev fica '/' por default; em build de produção pode ser sobrescrito
  // com `VITE_BASE_PATH=/v2/ npm run build`.
  const basePath = env.VITE_BASE_PATH || '/'

  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      // Sobe o limite só pra silenciar o warning ruidoso, sem mascarar problemas:
      // já fizemos route-level code splitting via lazy() + manualChunks abaixo.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Vite 8 / rolldown exige manualChunks como função.
          // Quebra bibliotecas grandes que mudam pouco em chunks de longo cache,
          // evitando invalidar tudo a cada deploy.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (
              id.includes('/react-router') ||
              id.includes('/react-dom/') ||
              id.includes('/react/')
            ) {
              return 'vendor-react'
            }
            if (id.includes('@tanstack/react-query')) return 'vendor-query'
            if (id.includes('i18next') || id.includes('react-i18next'))
              return 'vendor-i18n'
            if (
              id.includes('react-hook-form') ||
              id.includes('zod') ||
              id.includes('@hookform/resolvers')
            ) {
              return 'vendor-form'
            }
            if (id.includes('@radix-ui')) return 'vendor-radix'
            return undefined
          },
        },
      },
    },
  }
})
