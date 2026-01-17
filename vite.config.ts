import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Check if ts-query is in parent directory (local dev) or current directory (CI)
const tsQueryPath = fs.existsSync(path.resolve(__dirname, '../ts-query'))
  ? '../ts-query'
  : './ts-query';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@ts-query/core': path.resolve(__dirname, `${tsQueryPath}/packages/core/src/index.ts`),
      '@ts-query/react': path.resolve(__dirname, `${tsQueryPath}/packages/react/src/index.ts`),
      '@ts-query/ui-react': path.resolve(__dirname, `${tsQueryPath}/packages/ui-react/src/index.ts`),
      // Force ts-query packages to use the same React instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
})
