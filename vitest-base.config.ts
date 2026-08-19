import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // worker_threads/forks pools deadlock on the /mnt/c (drvfs/WSL) filesystem,
    // hanging `ng test` at startup. Run in a single forked process instead.
    // (Vitest 4 flattened poolOptions to top-level; `singleFork` replaces
    // the old `poolOptions.forks.singleFork`.)
    pool: 'forks',
    singleFork: true,
  },
});
