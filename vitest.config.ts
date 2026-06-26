import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$env/static/private': fileURLToPath(
        new URL('./tests/mocks/private-env.ts', import.meta.url)
      ),
      '$env/dynamic/private': fileURLToPath(
        new URL('./tests/mocks/private-env.ts', import.meta.url)
      )
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
