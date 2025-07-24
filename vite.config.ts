import type { PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // TODO: Add PWA
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   devOptions: {
    //     enabled: true,
    //   },
    //   // Generate with https://favicon.inbrowser.app/tools/favicon-generator
    //   manifest: false,
    // }) as unknown as PluginOption,
  ],
})
