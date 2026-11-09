import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Node 25+ enables its own `localStorage` global, which shadows jsdom's in tests.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const testExecArgv = nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [];

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
    poolOptions: {
      forks: { execArgv: testExecArgv },
      threads: { execArgv: testExecArgv },
    },
  },
});
