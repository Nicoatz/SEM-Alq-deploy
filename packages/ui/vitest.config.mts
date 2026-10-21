/**
 * vitest.config.mts — tests de @rentar/ui (`npm test --workspace=@rentar/ui`).
 *
 * jsdom para montar los componentes con Testing Library; Vite resuelve solo los
 * `.module.css`. Los tests van al lado del archivo que prueban (`*.test.tsx`).
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
