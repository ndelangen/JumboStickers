import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // The preview runs entirely in the browser. Its UI dependencies mark client modules for SSR frameworks.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) return
        warn(warning)
      },
    },
  },
})
