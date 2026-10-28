/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

// https://vite.dev/config/
const environmentPorts: Record<string, number> = {
  development: 9090,
  production: 2000,
}

export default defineConfig(({ mode }) => {
  const rootEnvironment = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const backendPort =
    Number(rootEnvironment.PORT) ||
    environmentPorts[mode] ||
    environmentPorts.development
  const backendOrigin = `http://127.0.0.1:${backendPort}`

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('@radix-ui') || id.includes('@floating-ui')) {
              return 'vendor-radix'
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: [
        'react',
        'react-dom',
        '@radix-ui/react-context',
        '@radix-ui/react-popper',
        '@radix-ui/react-portal',
        '@radix-ui/react-slot',
        '@radix-ui/react-compose-refs',
        '@radix-ui/react-use-callback-ref',
      ],
    },
    server: {
      host: true,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendOrigin,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendOrigin,
          changeOrigin: true,
          ws: true,
        },
      },
      port: 9091,
    },
    test: {
      silent: 'passed-only',
      unstubEnvs: true,
      browser: {
        enabled: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
      coverage: {
        // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
        exclude: [
          'src/components/ui/**',
          'src/assets/**',
          'src/tanstack-table.d.ts',
          'src/routeTree.gen.ts',
          'src/test-utils/**',
          'src/routes/**',
        ],
      },
    },
  }
})
