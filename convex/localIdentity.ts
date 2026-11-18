import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { localOrigin, localAudience } from './localOrigin'
import { collectorByIdentity } from './collectors'

const persona = v.union(v.literal('noor'), v.literal('sam'), v.literal('eva'))
const names = { noor: 'Noor V.', sam: 'Sam B.', eva: 'Eva P.' }

export const signIn = mutation({
  args: { persona, create: v.boolean(), expected: v.optional(v.id('collectors')) },
  returns: v.union(v.null(), v.object({ token: v.string(), id: v.id('collectors'), historyKey: v.string() })),
  handler: async (ctx, { persona: account, create, expected }) => {
    const origin = localOrigin()
    if (!origin) throw new ConvexError('Proefaccounts zijn alleen lokaal beschikbaar.')
    const identity = `${origin}|local:${account}`
    const collector = await collectorByIdentity(ctx, identity)
    if (collector?.deleting || (expected && collector?._id !== expected)) return null
    if (!create && !expected && (!collector || collector.localHistoryById)) return null

    const example = account === 'noor' ? { wanted: 12, spare: 34 } : account === 'sam' ? { wanted: 34, spare: 12 } : null
    const id = collector?._id ?? await ctx.db.insert('collectors', {
      identity, displayName: names[account], digest: false, localHistoryById: true,
      album: example ? { [example.wanted]: 'wanted', [example.spare]: 'owned' } : {},
    })
    if (!collector && example) {
      await ctx.db.insert('offers', { owner: id, number: example.spare, interestedCount: 0, status: 'available' })
    }
    const token = await ctx.auth.signJwt({
      claims: { sub: id, aud: localAudience },
      expiresInSeconds: 15 * 60,
    })
    const historyKey = collector && !collector.localHistoryById ? `local:${account}` : `local:${id}`
    return { token, id, historyKey }
  },
})
