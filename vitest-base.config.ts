import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Component specs (templateUrl) and the existing specs rely on vitest globals
    // (describe/it/expect) without importing them explicitly.
    globals: true,
    // The /mnt/c (drvfs/WSL) filesystem cannot spawn worker pools: the forks
    // pool needs child_process (unsupported here) and the threads pool deadlocks
    // on worker_threads IPC. vmThreads runs tests in-process via Node's vm
    // module (no separate worker), avoiding both problems. The @angular/build
    // unit-test builder supplies templateUrl/styleUrl resolution + TestBed init.
    pool: 'vmThreads',
    fileParallelism: false,
  },
});
