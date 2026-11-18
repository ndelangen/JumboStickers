export const unsubscribePath = '/afmelden'

export function isUnsubscribeToken(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/u.test(token)
}
