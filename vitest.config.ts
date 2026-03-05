import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/data/**', 'src/utils/**', 'src/server/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
