import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isAndroid = env.VITE_PLATFORM === 'android'

  return {
    define: {
      // SENTRY_DSN não é secreto (chave pública de ingestão), mas não tem
      // prefixo VITE_ porque é provisionado pela integração Sentry no
      // Vercel — expõe explicitamente para o bundle do cliente aqui em vez
      // de duplicar a env var com um segundo nome.
      __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN ?? ''),
    },
    plugins: [
      react(),
      // O app Android (Capacitor) ja empacota os assets localmente no WebView —
      // registrar um service worker ali é redundante e pode causar problemas de
      // cache dentro do protocolo customizado do Capacitor. PWA só faz sentido
      // para a versão web.
      !isAndroid &&
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'Personal Gym Control',
            short_name: 'Gym Control',
            description: 'Diário de treino e evolução corporal',
            lang: 'pt-BR',
            theme_color: '#aa3bff',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: '/',
            icons: [
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
              {
                src: 'pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
        }),
    ],
  }
})
