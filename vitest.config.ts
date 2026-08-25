import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['server/**', 'node_modules/**', 'dist/**', '**/node_modules/**'],
  },
});
