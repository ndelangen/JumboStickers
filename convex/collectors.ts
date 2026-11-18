import { ConvexError } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { localOrigin } from './localOrigin'

export function collectorByIdentity(ctx: QueryCtx | MutationCtx, identity: string) {
  return ctx.db.query('collectors').withIndex('by_identity', (q) => q.eq('identity', identity)).unique()
}

export async function currentCollector(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const localId = ctx.db.normalizeId('collectors', identity.subject)
  const collector = identity.issuer === localOrigin()
    ? localId && await ctx.db.get('collectors', localId)
    : await collectorByIdentity(ctx, identity.tokenIdentifier)
  return collector && !collector.deleting ? collector : null
}

export async function requireCollector(ctx: MutationCtx) {
  const collector = await currentCollector(ctx)
  if (!collector) throw new ConvexError('Log in om deze actie uit te voeren.')
  return collector
}
