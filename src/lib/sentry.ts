import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!__SENTRY_DSN__) return;

  Sentry.init({
    dsn: __SENTRY_DSN__,
    environment: import.meta.env.VITE_PLATFORM === 'android' ? 'android' : 'web',
    tracesSampleRate: 0.2,
  });
}
