export const localAudience = 'stickerruil-local'

export function localOrigin() {
  const url = process.env.CONVEX_CLOUD_URL
  return url && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/u.test(url) ? url : null
}
