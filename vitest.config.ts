import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
      ],
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@ts-query/core': path.resolve(__dirname, '../ts-query/packages/core/src/index.ts'),
      '@ts-query/react': path.resolve(__dirname, '../ts-query/packages/react/src/index.ts'),
      '@ts-query/ui-react': path.resolve(__dirname, '../ts-query/packages/ui-react/src/index.ts'),
      // Force ts-query packages to use the same React instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
});

