import type { AuthConfig } from 'convex/server'
import { localAudience, localOrigin } from './localOrigin'

const origin = localOrigin()
const descopeProject = process.env.DESCOPE_PROJECT_ID
const descopeApi = process.env.DESCOPE_API_URL

export default {
  providers: origin ? [{
    type: 'customJwt',
    issuer: origin,
    jwks: `${origin}/.well-known/jwks.json`,
    applicationID: localAudience,
    algorithm: 'ES256',
  }] : descopeProject && descopeApi ? [{
    type: 'customJwt',
    issuer: `${descopeApi}/v1/apps/${descopeProject}`,
    jwks: `${descopeApi}/v2/keys/${descopeProject}`,
    applicationID: descopeProject,
    algorithm: 'RS256',
  }] : [],
} satisfies AuthConfig
