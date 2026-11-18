import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalMutation, mutation, type MutationCtx } from './_generated/server'
import { currentCollector } from './collectors'

const batchSize = 100

async function purgeConversations(ctx: MutationCtx, collector: Id<'collectors'>) {
  const [owned, requested] = await Promise.all([
    ctx.db.query('conversations').withIndex('by_owner', (q) => q.eq('owner', collector)).take(5),
    ctx.db.query('conversations').withIndex('by_requester', (q) => q.eq('requester', collector)).take(5),
  ])
  for (const { _id } of [...owned, ...requested]) {
    const [messages, deliveries] = await Promise.all([
      ctx.db.query('unreadMessages').withIndex('by_conversation', (q) => q.eq('conversation', _id)).take(batchSize),
      ctx.db.query('messageDeliveries').withIndex('by_conversation', (q) => q.eq('conversation', _id)).take(batchSize),
    ])
    for (const message of messages) await ctx.db.delete('unreadMessages', message._id)
    for (const delivery of deliveries) await ctx.db.delete('messageDeliveries', delivery._id)
    if (messages.length < batchSize && deliveries.length < batchSize) await ctx.db.delete('conversations', _id)
  }
  return owned.length + requested.length > 0
}

async function purgeTrades(ctx: MutationCtx, collector: Id<'collectors'>) {
  const [outgoing, incoming, offers, promised] = await Promise.all([
    ctx.db.query('interests').withIndex('by_collector', (q) => q.eq('collector', collector)).take(batchSize),
    ctx.db.query('interests').withIndex('by_owner', (q) => q.eq('owner', collector)).take(batchSize),
    ctx.db.query('offers').withIndex('by_owner', (q) => q.eq('owner', collector)).take(batchSize),
    ctx.db.query('offers').withIndex('by_promisedTo', (q) => q.eq('promisedTo', collector)).take(batchSize),
  ])
  for (const interest of outgoing) {
    const offer = await ctx.db.get('offers', interest.offer)
    if (offer) await ctx.db.patch('offers', offer._id, { interestedCount: offer.interestedCount - 1 })
    await ctx.db.delete('interests', interest._id)
  }
  for (const interest of incoming) await ctx.db.delete('interests', interest._id)
  for (const offer of promised) await ctx.db.patch('offers', offer._id, { status: 'available', promisedTo: undefined })
  for (const offer of offers) await ctx.db.delete('offers', offer._id)
  return outgoing.length + incoming.length + offers.length + promised.length > 0
}

export const eraseOwn = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!await ctx.auth.getUserIdentity()) throw new ConvexError('Log in om je account te verwijderen.')
    const collector = await currentCollector(ctx)
    if (!collector) return null
    await ctx.db.patch('collectors', collector._id, { deleting: true, displayName: '', album: {}, digest: false })
    await ctx.scheduler.runAfter(0, internal.account.purge, { collector: collector._id })
    return null
  },
})

export const purge = internalMutation({
  args: { collector: v.id('collectors') },
  returns: v.null(),
  handler: async (ctx, { collector }) => {
    const profile = await ctx.db.get('collectors', collector)
    if (!profile?.deleting) return null
    const hasConversations = await purgeConversations(ctx, collector)
    const hasTrades = await purgeTrades(ctx, collector)
    const [messages, deliveries] = await Promise.all([
      ctx.db.query('unreadMessages').withIndex('by_recipient', (q) => q.eq('recipient', collector)).take(batchSize),
      ctx.db.query('messageDeliveries').withIndex('by_sender_and_clientId', (q) => q.eq('sender', collector)).take(batchSize),
    ])
    for (const message of messages) await ctx.db.delete('unreadMessages', message._id)
    for (const delivery of deliveries) await ctx.db.delete('messageDeliveries', delivery._id)
    if (hasConversations || hasTrades || messages.length || deliveries.length) {
      await ctx.scheduler.runAfter(0, internal.account.purge, { collector })
    } else {
      await ctx.db.delete('collectors', collector)
    }
    return null
  },
})
