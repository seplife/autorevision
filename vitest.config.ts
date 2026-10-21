import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/unit/setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          // Les tests partagent une même base : exécution séquentielle.
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
