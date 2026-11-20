import { paginationOptsValidator, type UserIdentity } from 'convex/server'
import { mergedStream, stream } from 'convex-helpers/server/stream'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from './_generated/server'
import { currentCollector, isDescopeSession, requireCollector } from './collectors'
import { inboxLimit, unreadRetentionMs } from './inbox'
import { composeDigest } from './digestMail'
import schema from './schema'
import { isUnsubscribeToken } from '../shared/digestLinks'

const timezone = 'Europe/Amsterdam'
const pageSize = 10
const maxRecipients = 100
const twoDays = 2 * 24 * 60 * 60 * 1000
const senderPattern = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/u

function settings() {
  const url = process.env.DIGEST_MAILER_URL
  const secret = process.env.DIGEST_MAILER_SECRET
  const site = process.env.DIGEST_SITE_URL
  return url && senderPattern.test(url) && secret && secret.length >= 32 &&
    site && /^https:\/\/[\w.-]+$/u.test(site) ? { url, secret, site } : null
}

function emailFor(identity: UserIdentity) {
  // Convex custom JWT providers expose this claim under its original name.
  const verification = [identity.emailVerified, identity.email_verified].filter((claim) => claim !== undefined)
  return isDescopeSession(identity) && verification.length > 0 && verification.every((claim) => claim === true) && identity.email &&
    /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/u.test(identity.email) ? identity.email : null
}

function localParts(time: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(time)
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === key)?.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')), minute: Number(part('minute')) }
}

export const preferences = query({
  args: {},
  returns: v.object({
    available: v.boolean(), subscribed: v.boolean(), unreadSubscribed: v.boolean(),
    unreadReminderSeen: v.boolean(), verifiedEmail: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    const collector = await currentCollector(ctx)
    const subscription = collector && await ctx.db.query('digestSubscriptions')
      .withIndex('by_collector', (q) => q.eq('collector', collector._id)).unique()
    return {
      available: !!settings(), subscribed: !!subscription && subscription.tradesEnabled !== false,
      unreadSubscribed: subscription?.unreadEnabled === true, unreadReminderSeen: collector?.unreadReminderSeen === true,
      verifiedEmail: !!(identity && emailFor(identity)),
    }
  },
})

export const subscribe = mutation({
  args: { enabled: v.boolean(), kind: v.optional(v.union(v.literal('trades'), v.literal('unread'))) },
  returns: v.null(),
  handler: async (ctx, { enabled, kind = 'trades' }) => {
    const collector = await requireCollector(ctx)
    const subscription = await ctx.db.query('digestSubscriptions')
      .withIndex('by_collector', (q) => q.eq('collector', collector._id)).unique()
    const tradesEnabled = kind === 'trades' ? enabled : !!subscription && subscription.tradesEnabled !== false
    const unreadEnabled = kind === 'unread' ? enabled : subscription?.unreadEnabled === true
    if (!tradesEnabled && !unreadEnabled) {
      if (subscription) await ctx.db.delete('digestSubscriptions', subscription._id)
      return null
    }
    let email = subscription?.email
    if (enabled) {
      if (!settings()) throw new ConvexError('Dagelijkse mails zijn nog niet beschikbaar.')
      const identity = await ctx.auth.getUserIdentity()
      email = (identity && emailFor(identity)) ?? undefined
    }
    if (!email) throw new ConvexError('Log opnieuw in met een link uit je e-mail.')
    if (subscription) {
      const unsubscribeToken = tradesEnabled && subscription.tradesEnabled === false ? crypto.randomUUID() : subscription.unsubscribeToken
      await ctx.db.patch('digestSubscriptions', subscription._id, { email, tradesEnabled, unreadEnabled, unsubscribeToken })
    } else {
      await ctx.db.insert('digestSubscriptions', { collector: collector._id, email, tradesEnabled, unreadEnabled, unsubscribeToken: crypto.randomUUID() })
    }
    if (kind === 'unread' && enabled && !collector.unreadReminderSeen) {
      await ctx.db.patch('collectors', collector._id, { unreadReminderSeen: true })
    }
    return null
  },
})

export const claimUnreadReminder = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const collector = await requireCollector(ctx)
    if (!settings() || collector.unreadReminderSeen) return false
    await ctx.db.patch('collectors', collector._id, { unreadReminderSeen: true })
    return true
  },
})

// The random token in the email authorizes this single operation.
export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { token }) => {
    if (!isUnsubscribeToken(token)) return false
    const row = await ctx.db.query('digestSubscriptions').withIndex('by_unsubscribeToken', (q) => q.eq('unsubscribeToken', token)).unique()
    if (!row || row.tradesEnabled === false) return false
    if (row.unreadEnabled) await ctx.db.patch('digestSubscriptions', row._id, { tradesEnabled: false })
    else await ctx.db.delete('digestSubscriptions', row._id)
    return true
  },
})

export const begin = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { date, hour, minute } = localParts(Date.now())
    if (!settings() || hour !== 16 || minute >= 30) return null
    const existing = await ctx.db.query('digestRounds').withIndex('by_date', (q) => q.eq('date', date)).unique()
    if (existing?.finished) return null
    const round = existing?._id ?? await ctx.db.insert('digestRounds', { date, cursor: null, dispatched: 0, finished: false })
    await ctx.scheduler.runAfter(0, internal.digest.deliverPage, { round })
    return null
  },
})

export const subscribers = internalQuery({
  args: { round: v.id('digestRounds') },
  returns: v.union(v.null(), v.object({
    date: v.string(), ids: v.array(v.id('digestSubscriptions')), previous: v.union(v.null(), v.string()),
    cursor: v.string(), done: v.boolean(),
  })),
  handler: async (ctx, { round }) => {
    const current = await ctx.db.get('digestRounds', round)
    if (!current || current.finished || current.dispatched >= maxRecipients) return null
    const result = await ctx.db.query('digestSubscriptions').withIndex('by_lastSent').paginate({ cursor: current.cursor, numItems: pageSize })
    return { date: current.date, ids: result.page.map(({ _id }) => _id), previous: current.cursor,
      cursor: result.continueCursor, done: result.isDone }
  },
})

export const advance = internalMutation({
  args: { round: v.id('digestRounds'), previous: v.union(v.null(), v.string()), cursor: v.string(), done: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { round, previous, cursor, done }) => {
    const current = await ctx.db.get('digestRounds', round)
    if (!current || current.finished || current.cursor !== previous) return null
    const finished = done || current.dispatched >= maxRecipients
    await ctx.db.patch('digestRounds', round, { cursor, finished })
    if (!finished) await ctx.scheduler.runAfter(0, internal.digest.deliverPage, { round })
    return null
  },
})

async function eligible(ctx: Pick<QueryCtx, 'db'>, collector: Doc<'collectors'>, offer: Doc<'offers'>) {
  if (collector.album[offer.number] !== 'wanted' || offer.owner === collector._id || offer.status !== 'available' ||
      offer.interestedCount !== 0 || offer.hadInterest || offer.promisedTo) return false
  if (offer.hadInterest === undefined && await ctx.db.query('conversations').withIndex('by_offer_and_requester', (q) =>
    q.eq('offer', offer._id)).first()) return false
  if (await ctx.db.query('digestNotices').withIndex('by_collector_and_offer', (q) =>
    q.eq('collector', collector._id).eq('offer', offer._id)).unique()) return false
  const owner = await ctx.db.get('collectors', offer.owner)
  return !!owner && !owner.deleting &&
    (!collector.searchDistricts?.length || (!!owner.district && collector.searchDistricts.includes(owner.district)))
}

export const candidates = internalQuery({
  args: { subscription: v.id('digestSubscriptions'), date: v.string(), pagination: paginationOptsValidator, indexed: v.optional(v.boolean()) },
  returns: v.union(v.null(), v.object({
    offers: v.array(v.object({ id: v.id('offers'), number: v.number() })), wanted: v.number(), cursor: v.string(), done: v.boolean(),
  })),
  handler: async (ctx, { subscription, date, pagination, indexed }) => {
    const contact = await ctx.db.get('digestSubscriptions', subscription)
    if (!contact || contact.tradesEnabled === false) return null
    const collector = await ctx.db.get('collectors', contact.collector)
    if (!collector || collector.deleting) return null
    if (await ctx.db.query('digestAttempts').withIndex('by_collector_and_date', (q) =>
      q.eq('collector', collector._id).eq('date', date)).unique()) return null
    const wantedNumbers = Object.keys(collector.album).map(Number).filter((number) => collector.album[number] === 'wanted')
    if (!wantedNumbers.length) return null
    // Keep the original cursor format for email actions that started before the deploy.
    const result = indexed
      ? await mergedStream(wantedNumbers.map((number) =>
        stream(ctx.db, schema).query('offers').withIndex('by_status_and_number', (q) =>
          q.eq('status', 'available').eq('number', number).eq('interestedCount', 0)),
      ), ['_creationTime', '_id']).paginate(pagination)
      : await ctx.db.query('offers').withIndex('by_status_and_interestedCount', (q) =>
        q.eq('status', 'available').eq('interestedCount', 0)).paginate(pagination)
    const offers: { id: Id<'offers'>, number: number }[] = []
    const included = new Set<number>()
    for (const offer of result.page) {
      if (included.has(offer.number) || !await eligible(ctx, collector, offer)) continue
      included.add(offer.number)
      offers.push({ id: offer._id, number: offer.number })
    }
    return { offers, wanted: wantedNumbers.length, cursor: result.continueCursor, done: result.isDone }
  },
})

const delivery = v.object({
  id: v.id('digestAttempts'),
  email: v.string(),
  unsubscribeToken: v.string(),
  numbers: v.array(v.number()),
  unreadCount: v.number(),
  notices: v.array(v.id('digestNotices')),
})

async function countUnread(ctx: Pick<QueryCtx, 'db'>, recipient: Id<'collectors'>) {
  const cutoff = Date.now() - unreadRetentionMs
  const messages = await ctx.db.query('unreadMessages').withIndex('by_recipient', (q) =>
    q.eq('recipient', recipient).gt('_creationTime', cutoff)).take(inboxLimit)
  const conversations = await Promise.all([...new Set(messages.map(({ conversation }) => conversation))]
    .map((id) => ctx.db.get('conversations', id)))
  const sendersByConversation = new Map(conversations.flatMap((conversation) => {
    if (!conversation) return []
    if (conversation.owner === recipient && !conversation.ownerHidden) return [[conversation._id, conversation.requester] as const]
    return conversation.requester === recipient && !conversation.requesterHidden ? [[conversation._id, conversation.owner] as const] : []
  }))
  const senders = await Promise.all([...new Set(sendersByConversation.values())].map((id) => ctx.db.get('collectors', id)))
  const active = new Set(senders.flatMap((sender) => sender && !sender.deleting ? [sender._id] : []))
  return messages.filter(({ conversation }) => {
    const sender = sendersByConversation.get(conversation)
    return sender && active.has(sender)
  }).length
}

export const reserve = internalMutation({
  args: { subscription: v.id('digestSubscriptions'), round: v.id('digestRounds'), offers: v.array(v.id('offers')) },
  returns: v.union(v.null(), delivery),
  handler: async (ctx, { subscription, round, offers }) => {
    const current = await ctx.db.get('digestRounds', round)
    if (!current || current.finished || current.dispatched >= maxRecipients) return null
    const contact = await ctx.db.get('digestSubscriptions', subscription)
    const collector = contact && await ctx.db.get('collectors', contact.collector)
    if (!contact || !collector || collector.deleting) return null
    if (await ctx.db.query('digestAttempts').withIndex('by_collector_and_date', (q) =>
      q.eq('collector', collector._id).eq('date', current.date)).unique()) return null
    const matches: Doc<'offers'>[] = []
    const seen = new Set<number>()
    for (const id of contact.tradesEnabled === false ? [] : offers) {
      const offer = await ctx.db.get('offers', id)
      if (!offer || seen.has(offer.number) || !await eligible(ctx, collector, offer)) continue
      seen.add(offer.number)
      matches.push(offer)
    }
    const unreadCount = contact.unreadEnabled ? await countUnread(ctx, collector._id) : 0
    if (!matches.length && !unreadCount) return null
    const id = await ctx.db.insert('digestAttempts', { collector: collector._id, date: current.date })
    await ctx.db.patch('digestRounds', round, { dispatched: current.dispatched + 1 })
    await ctx.scheduler.runAfter(twoDays, internal.digest.expireAttempt, { id })
    const notices = await Promise.all(matches.map(({ _id }) => ctx.db.insert('digestNotices', { collector: collector._id, offer: _id })))
    return { id, email: contact.email, unsubscribeToken: contact.unsubscribeToken, numbers: matches.map(({ number }) => number), unreadCount, notices }
  },
})

export const release = internalMutation({
  args: { notices: v.array(v.id('digestNotices')) },
  returns: v.null(),
  handler: async (ctx, { notices }) => {
    for (const notice of notices) {
      if (await ctx.db.get('digestNotices', notice)) await ctx.db.delete('digestNotices', notice)
    }
    return null
  },
})

export const sent = internalMutation({
  args: { subscription: v.id('digestSubscriptions'), date: v.string() },
  returns: v.null(),
  handler: async (ctx, { subscription, date }) => {
    if (await ctx.db.get('digestSubscriptions', subscription)) {
      await ctx.db.patch('digestSubscriptions', subscription, { lastSent: date })
    }
    return null
  },
})

export const expireAttempt = internalMutation({
  args: { id: v.id('digestAttempts') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await ctx.db.get('digestAttempts', id)) await ctx.db.delete('digestAttempts', id)
    return null
  },
})

export const deliverPage = internalAction({
  args: { round: v.id('digestRounds') },
  returns: v.null(),
  handler: async (ctx, { round }) => {
    const config = settings()
    if (!config) return null
    const page: { date: string, ids: Id<'digestSubscriptions'>[], previous: string | null, cursor: string, done: boolean } | null =
      await ctx.runQuery(internal.digest.subscribers, { round })
    const inWindow = () => {
      const local = localParts(Date.now())
      return local.date === page?.date && local.hour === 16 && local.minute < 30
    }
    if (!page || !inWindow()) return null
    for (const subscription of page.ids) {
      if (!inWindow()) return null
      try {
        const offers = new Map<number, Id<'offers'>>()
        let cursor: string | null = null
        while (true) {
          const candidates: { offers: { id: Id<'offers'>, number: number }[], wanted: number, cursor: string, done: boolean } | null =
            await ctx.runQuery(internal.digest.candidates, { subscription, date: page.date, indexed: true, pagination: { cursor, numItems: 100 } })
          if (!candidates) break
          for (const { id, number } of candidates.offers) if (!offers.has(number)) offers.set(number, id)
          if (candidates.done || offers.size >= candidates.wanted) break
          cursor = candidates.cursor
        }
        if (!inWindow()) continue
        const message = await ctx.runMutation(internal.digest.reserve, { subscription, round, offers: [...offers.values()] })
        if (!message) continue
        const content = composeDigest(config.site, message)
        const response = await fetch(config.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: config.secret, id: message.id, recipient: message.email, ...content }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) continue
        const result = await response.json() as { status?: string }
        if (result.status === 'quota' || result.status === 'denied') {
          await ctx.runMutation(internal.digest.release, { notices: message.notices })
          if (result.status === 'denied') console.error('The daily email service rejected the request.')
          await ctx.runMutation(internal.digest.advance, { round, previous: page.previous, cursor: page.cursor, done: true })
          return null
        }
        if (result.status === 'sent' || result.status === 'duplicate') {
          await ctx.runMutation(internal.digest.sent, { subscription, date: page.date })
        }
      } catch {
        // MailApp has no delivery lookup. Keep reservations when the outcome is unknown.
        console.error('Could not process the daily email or confirm it was sent.')
      }
    }
    await ctx.runMutation(internal.digest.advance, { round, previous: page.previous, cursor: page.cursor, done: page.done })
    return null
  },
})
