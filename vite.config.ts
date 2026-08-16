import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function resolveCommitSha(): string {
  // Vercel e GitHub Actions já expõem o commit atual via env var — evita
  // depender de `git` estar disponível no ambiente de build.
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

function resolveAppVersion(): string {
  // No build do APK (GitHub Actions, ver .github/workflows/android-apk.yml)
  // o versionCode/versionName do pacote Android já usa github.run_number —
  // a versão exibida no app acompanha o mesmo número (1.0.<run_number>)
  // pra sempre bater com o APK instalado. Fora desse contexto (web/local),
  // usa o version do package.json normalmente.
  const runNumber = process.env.GITHUB_RUN_NUMBER
  if (runNumber) return `1.0.${runNumber}`
  return pkg.version
}

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
      // Versão exibida no topo do app (web e Android, mesmo bundle) — ver
      // resolveAppVersion acima. O commit é só um detalhe extra pra
      // identificar o build exato.
      __APP_VERSION__: JSON.stringify(resolveAppVersion()),
      __APP_COMMIT__: JSON.stringify(resolveCommitSha()),
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
            theme_color: '#D9A441',
            background_color: '#17181A',
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
