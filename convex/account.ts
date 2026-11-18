import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalMutation, mutation, type MutationCtx } from './_generated/server'
import { collectorByIdentity, currentCollector, isDescopeSession } from './collectors'
import { localOrigin } from './localOrigin'
import { districtValidator, searchDistrictsValidator, uniqueDistricts } from './districts'

const batchSize = 100

async function purgeConversations(ctx: MutationCtx, collector: Id<'collectors'>) {
  const [owned, requested] = await Promise.all([
    ctx.db.query('conversations').withIndex('by_owner', (q) => q.eq('owner', collector)).take(5),
    ctx.db.query('conversations').withIndex('by_requester', (q) => q.eq('requester', collector)).take(5),
  ])
  for (const { _id, offer } of [...owned, ...requested]) {
    const offered = await ctx.db.get('offers', offer)
    if (offered && offered.hadInterest !== true) await ctx.db.patch('offers', offer, { hadInterest: true })
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
    if (offer) await ctx.db.patch('offers', offer._id, { interestedCount: offer.interestedCount - 1, hadInterest: true })
    await ctx.db.delete('interests', interest._id)
  }
  for (const interest of incoming) await ctx.db.delete('interests', interest._id)
  for (const offer of promised) await ctx.db.patch('offers', offer._id, { status: 'available', promisedTo: undefined })
  for (const offer of offers) await ctx.db.delete('offers', offer._id)
  return outgoing.length + incoming.length + offers.length + promised.length > 0
}

export const registerOwn = mutation({
  args: {
    displayName: v.string(),
    district: v.optional(districtValidator),
    searchDistricts: v.optional(searchDistrictsValidator),
  },
  returns: v.null(),
  handler: async (ctx, { displayName, district, searchDistricts }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || !isDescopeSession(identity)) throw new ConvexError('Log in via de link in je e-mail.')
    const existing = await collectorByIdentity(ctx, identity.tokenIdentifier)
    if (existing?.deleting) throw new ConvexError('Je vorige profiel wordt nog gewist. Probeer het straks opnieuw.')
    if (existing) return null
    const name = displayName.trim()
    if (!name || name.length > 32) throw new ConvexError('Kies een schermnaam van maximaal 32 tekens.')
    await ctx.db.insert('collectors', {
      identity: identity.tokenIdentifier,
      displayName: name,
      district,
      searchDistricts: searchDistricts && uniqueDistricts(searchDistricts),
      album: {},
      digest: false,
    })
    return null
  },
})

export const eraseOwn = mutation({
  args: { expected: v.optional(v.id('collectors')) },
  returns: v.null(),
  handler: async (ctx, { expected }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity || (identity.issuer !== localOrigin() && !isDescopeSession(identity))) {
      throw new ConvexError('Log in om je account te verwijderen.')
    }
    const collector = await currentCollector(ctx)
    if (!collector) return null
    if ((expected && collector._id !== expected) || (!expected && identity.issuer !== localOrigin())) {
      throw new ConvexError('Je profiel is gewijzigd. Open Instellingen opnieuw.')
    }
    await ctx.db.patch('collectors', collector._id, {
      deleting: true, displayName: '', district: undefined, searchDistricts: undefined, album: {}, digest: false,
    })
    const subscription = await ctx.db.query('digestSubscriptions').withIndex('by_collector', (q) => q.eq('collector', collector._id)).unique()
    if (subscription) await ctx.db.delete('digestSubscriptions', subscription._id)
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
    const [messages, deliveries, notices, attempts, blockedBy, blocking] = await Promise.all([
      ctx.db.query('unreadMessages').withIndex('by_recipient', (q) => q.eq('recipient', collector)).take(batchSize),
      ctx.db.query('messageDeliveries').withIndex('by_sender_and_clientId', (q) => q.eq('sender', collector)).take(batchSize),
      ctx.db.query('digestNotices').withIndex('by_collector_and_offer', (q) => q.eq('collector', collector)).take(batchSize),
      ctx.db.query('digestAttempts').withIndex('by_collector_and_date', (q) => q.eq('collector', collector)).take(batchSize),
      ctx.db.query('messageBlocks').withIndex('by_blocked', (q) => q.eq('blocked', collector)).take(batchSize),
      ctx.db.query('messageBlocks').withIndex('by_blocker_and_blocked', (q) => q.eq('blocker', collector)).take(batchSize),
    ])
    for (const message of messages) await ctx.db.delete('unreadMessages', message._id)
    for (const delivery of deliveries) await ctx.db.delete('messageDeliveries', delivery._id)
    for (const notice of notices) await ctx.db.delete('digestNotices', notice._id)
    for (const attempt of attempts) await ctx.db.delete('digestAttempts', attempt._id)
    for (const block of [...blockedBy, ...blocking]) await ctx.db.delete('messageBlocks', block._id)
    if (hasConversations || hasTrades || messages.length || deliveries.length ||
        notices.length || attempts.length || blockedBy.length || blocking.length) {
      await ctx.scheduler.runAfter(0, internal.account.purge, { collector })
    } else {
      await ctx.db.delete('collectors', collector)
    }
    return null
  },
})
