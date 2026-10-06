import { defineConfig } from 'vite';

// Perf config (A16). Phaser is ~1.5 MB minified and cannot be split further, so it lives in its own
// long-cacheable chunk (content-hashed; only changes when the phaser version changes). Game code
// then ships as a small chunk that changes every release without invalidating the engine cache.
export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: false,
    // Phaser alone is ~1.5 MB min; warn only if it grows well past that or game code balloons.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/phaser/') || id.includes('node_modules/eventemitter3/') || id.includes('node_modules/phaser3-rex')) return 'phaser';
          return undefined;
        },
      },
    },
  },
});
