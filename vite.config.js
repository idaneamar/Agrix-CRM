import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Agrix-CRM/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
      manifest: {
        name: 'Agrix CRM',
        short_name: 'Agrix',
        description: 'מערכת ניהול לקוחות — Agrix ייבוא פיצוחים ומזון',
        dir: 'rtl',
        lang: 'he',
        start_url: '/Agrix-CRM/',
        scope: '/Agrix-CRM/',
        display: 'standalone',
        background_color: '#f9f9f7',
        theme_color: '#1c5cab',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
