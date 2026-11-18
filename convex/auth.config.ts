import type { AuthConfig } from 'convex/server'
import { localAudience, localOrigin } from './localOrigin'

const origin = localOrigin()

export default {
  providers: origin ? [{
    type: 'customJwt',
    issuer: origin,
    jwks: `${origin}/.well-known/jwks.json`,
    applicationID: localAudience,
    algorithm: 'ES256',
  }] : [],
} satisfies AuthConfig
