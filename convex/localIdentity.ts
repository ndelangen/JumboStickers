import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { localOrigin, localAudience } from './localOrigin'

const persona = v.union(v.literal('noor'), v.literal('sam'), v.literal('eva'))
const names = { noor: 'Noor V.', sam: 'Sam B.', eva: 'Eva P.' }

export const signIn = mutation({
  args: { persona },
  returns: v.string(),
  handler: async (ctx, { persona: account }) => {
    if (!localOrigin()) throw new ConvexError('Proefaccounts zijn alleen lokaal beschikbaar.')
    return await ctx.auth.signJwt({
      claims: { sub: `local:${account}`, aud: localAudience, name: names[account] },
      expiresInSeconds: 15 * 60,
    })
  },
})
