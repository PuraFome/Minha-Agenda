import { defineConfig } from 'vitest/config';

// Consumed by the `@angular/build:unit-test` builder (`ng test`, see
// angular.json `runnerConfig: true`). The builder supplies the Angular
// compiler plugin that resolves templateUrl/styleUrl and initializes TestBed,
// so no custom setupFiles are needed here. `globals: true` lets specs use
// describe/it/expect without importing them. On the /mnt/c (drvfs/WSL)
// filesystem the forks pool deadlocks (IPC hang); `threads` starts reliably.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    exclude: ['server/**', 'node_modules/**', 'dist/**', '**/node_modules/**'],
    pool: 'threads',
  },
});
