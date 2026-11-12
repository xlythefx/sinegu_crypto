import { defineConfig } from 'vitest/config'

// Unit tests for the pure libraries (lib/videoEditor/*). No React plugin is
// needed. `vmThreads`: on Windows the default pools fail to start when the
// shell's working directory has a lower-case drive letter ("c:\…"), which is
// how editors open this folder.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    pool: 'vmThreads',
  },
})
