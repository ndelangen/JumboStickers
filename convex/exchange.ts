import { ConvexError, v } from 'convex/values'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { batchAlbumArgs, offerLimit, validNumbers } from './album'
import { inboxLimit, unreadRetentionMs } from './inbox'
import { exchangeCommand } from './demo'
import { currentCollector, requireCollector } from './collectors'
import { demoStateFields, incoming, offer as offerValidator } from './schema'
import { districtValidator, uniqueDistricts } from './districts'
import { recordMessageForReplyFilter } from './replyWaits'

const peopleValidator = v.record(v.string(), v.object({
  name: v.string(),
  wants: v.array(v.number()),
  district: v.optional(districtValidator),
}))
const snapshotValidator = v.object({
  ...demoStateFields,
  people: peopleValidator,
  collectorId: v.id('collectors'),
  unread: v.optional(v.array(v.object({ id: v.id('unreadMessages'), threadId: v.id('conversations') }))),
})
const unreadPerSender = 5
const expiryBatchSize = 500
const interestCleanupBatchSize = 100
const localNetworkLimit = 3 * offerLimit
const resendWindowMs = 24 * 60 * 60 * 1000

function idFor<Table extends TableNames>(ctx: MutationCtx, table: Table, id: string) {
  const result = ctx.db.normalizeId(table, id)
  if (!result) throw new ConvexError('Dit onderdeel bestaat niet meer.')
  return result
}

async function ownOffers(ctx: QueryCtx | MutationCtx, owner: Id<'collectors'>) {
  return await ctx.db.query('offers').withIndex('by_owner', (q) => q.eq('owner', owner)).take(offerLimit)
}

function threadFields(thread: Doc<'conversations'>, viewer: Id<'collectors'>) {
  return thread.owner === viewer
    ? { hidden: 'ownerHidden', version: 'ownerHistoryVersion', visibleSince: 'ownerVisibleSince' } as const
    : { hidden: 'requesterHidden', version: 'requesterHistoryVersion', visibleSince: 'requesterVisibleSince' } as const
}

function threadView(thread: Doc<'conversations'>, viewer: Id<'collectors'>) {
  return {
    id: thread._id,
    offerId: thread.offer,
    number: thread.number,
    person: thread.owner === viewer ? thread.requester : thread.owner,
    historyVersion: thread[threadFields(thread, viewer).version],
  }
}

export const get = query({
  args: {
    sticker: v.optional(v.number()),
    personalOnly: v.optional(v.boolean()),
    view: v.optional(v.union(v.literal('shell'), v.literal('album'), v.literal('offers'), v.literal('messages'))),
  },
  returns: v.union(snapshotValidator, v.null()),
  handler: async (ctx, { sticker, personalOnly, view }) => {
    const me = await currentCollector(ctx)
    if (!me) return null

    const legacy = view === undefined
    const wantsThreads = legacy || view === 'messages'
    const wantsOwnOffers = legacy || view === 'offers' || view === 'album'
    const wantsInterests = legacy || view === 'offers'
    const readInbox = () => ctx.db.query('unreadMessages').withIndex('by_recipient', (q) =>
      q.eq('recipient', me._id)).take(inboxLimit)
    const [mine, general, linked, fromMe, forMe, opened, received, pending] = await Promise.all([
      wantsOwnOffers ? ownOffers(ctx, me._id) : [],
      legacy && !personalOnly ? ctx.db.query('offers').withIndex('by_status', (q) => q.eq('status', 'available')).take(localNetworkLimit) : [],
      legacy && !personalOnly && sticker !== undefined ? ctx.db.query('offers').withIndex('by_status_and_number', (q) =>
        q.eq('status', 'available').eq('number', sticker)).take(50) : [],
      legacy ? ctx.db.query('interests').withIndex('by_collector', (q) => q.eq('collector', me._id)).take(localNetworkLimit) : [],
      wantsInterests ? ctx.db.query('interests').withIndex('by_owner', (q) => q.eq('owner', me._id)).take(localNetworkLimit) : [],
      wantsThreads ? ctx.db.query('conversations').withIndex('by_requester_and_requesterHidden_and_requesterVisibleSince',
        (q) => q.eq('requester', me._id).eq('requesterHidden', undefined)).order('desc').take(localNetworkLimit) : [],
      wantsThreads ? ctx.db.query('conversations').withIndex('by_owner_and_ownerHidden_and_ownerVisibleSince',
        (q) => q.eq('owner', me._id).eq('ownerHidden', undefined)).order('desc').take(localNetworkLimit) : [],
      legacy || view === 'shell' ? readInbox() : [],
    ])
    const inbox = view === 'messages' && (opened.length === localNetworkLimit || received.length === localNetworkLimit)
      ? await readInbox()
      : pending
    const available = [...general, ...linked]
    const mineInterested = new Set(fromMe.map((item) => item.offer))
    const receivedInterests = new Map<Id<'offers'>, Id<'collectors'>[]>()
    for (const interest of forMe) {
      const people = receivedInterests.get(interest.offer) ?? []
      people.push(interest.collector)
      receivedInterests.set(interest.offer, people)
    }
    const availableIds = new Set(available.map((offer) => offer._id))
    const otherRequested = await Promise.all(fromMe.filter((item) => !availableIds.has(item.offer)).map((item) => ctx.db.get('offers', item.offer)))
    const offers = new Map<Id<'offers'>, Doc<'offers'>>()
    for (const offer of [...available, ...mine, ...otherRequested]) if (offer) offers.set(offer._id, offer)
    const threadMap = new Map([...opened, ...received].map((thread) => [thread._id, thread]))
    const olderUnread = [...new Set(inbox.map((message) => message.conversation))].filter((id) => !threadMap.has(id))
    for (const thread of await Promise.all(olderUnread.map((id) => ctx.db.get('conversations', id)))) {
      if (thread && (thread.owner === me._id || thread.requester === me._id) && !thread[threadFields(thread, me._id).hidden]) {
        threadMap.set(thread._id, thread)
      }
    }
    const visibleSince = (thread: Doc<'conversations'>) => thread[threadFields(thread, me._id).visibleSince] ?? thread._creationTime
    const candidates = [...threadMap.values()].sort((a, b) => visibleSince(b) - visibleSince(a)).map((thread) => threadView(thread, me._id))

    const ownAvailableNumbers = new Set(mine.filter((offer) => offer.status === 'available').map((offer) => offer.number))
    const offerOwners = new Set([...offers.values()].map((offer) => offer.owner))
    const related = new Set<Id<'collectors'>>([
      ...offerOwners,
      ...forMe.map((interest) => interest.collector),
      ...candidates.map((thread) => thread.person),
      ...(view === 'album' ? [] : mine.flatMap((offer) => offer.promisedTo ? [offer.promisedTo] : [])),
    ])
    related.delete(me._id)
    const profiles = (await Promise.all([...related].map((id) => ctx.db.get('collectors', id))))
      .filter((profile): profile is Doc<'collectors'> => !!profile && !profile.deleting)
    const active = new Set(profiles.map((profile) => profile._id))
    const threads = candidates.filter((thread) => active.has(thread.person))
    const threadVersions = new Map(threads.map((thread) => [thread.id, thread.historyVersion]))
    const visibleInbox = inbox.filter((message) => threadVersions.has(message.conversation))
    return {
      collectorId: me._id,
      displayName: me.displayName,
      district: me.district,
      searchDistricts: me.searchDistricts,
      digest: me.digest,
      album: me.album,
      people: Object.fromEntries(profiles.map((profile) => {
        const district = offerOwners.has(profile._id) ? profile.district : undefined
        return [profile._id, {
          name: profile.displayName,
          wants: legacy ? [...ownAvailableNumbers].filter((number) => profile.album[number] === 'wanted') : [],
          ...(district ? { district } : {}),
        }]
      })),
      offers: [...offers.values()].filter((offer) => offer.owner === me._id || active.has(offer.owner)).map((offer) => ({
        id: offer._id,
        number: offer.number,
        owner: offer.owner === me._id ? 'me' : offer.owner,
        interested: offer.owner === me._id ? (receivedInterests.get(offer._id) ?? []).filter((person) => active.has(person)) :
          mineInterested.has(offer._id) ? ['me'] : [],
        interestCount: offer.interestedCount,
        promisedTo: view === 'album' ? (offer.status === 'promised' ? 'reserved' : null) :
          offer.promisedTo === me._id ? 'me' : offer.owner === me._id ? offer.promisedTo && active.has(offer.promisedTo) ? offer.promisedTo : null :
            offer.status === 'promised' ? 'reserved' : null,
      })),
      threads: wantsThreads ? threads : [],
      inbox: legacy ? visibleInbox.map((message) => inboxMessage(message, threadVersions.get(message.conversation))) : [],
      unread: view === 'shell' ? visibleInbox.map((message) => ({ id: message._id, threadId: message.conversation })) : undefined,
    }
  },
})

function inboxMessage(message: Doc<'unreadMessages'>, historyVersion: number | undefined) {
  return { id: message._id, threadId: message.conversation, text: message.text, sentAt: message._creationTime, historyVersion }
}

function messageBlock(ctx: QueryCtx | MutationCtx, blocker: Id<'collectors'>, blocked: Id<'collectors'>) {
  return ctx.db.query('messageBlocks').withIndex('by_blocker_and_blocked',
    (q) => q.eq('blocker', blocker).eq('blocked', blocked)).unique()
}

async function messagesFrom(ctx: MutationCtx, recipient: Id<'collectors'>, sender: Id<'collectors'>, limit: number) {
  const messages = await ctx.db.query('unreadMessages').withIndex('by_recipient_and_sender',
    (q) => q.eq('recipient', recipient).eq('sender', sender)).take(limit)
  if (messages.length >= limit) return messages

  // Messages saved before the sender index identify the sender through their conversation.
  const legacy = await ctx.db.query('unreadMessages').withIndex('by_recipient_and_sender',
    (q) => q.eq('recipient', recipient).eq('sender', undefined)).take(inboxLimit)
  const conversations = await Promise.all([...new Set(legacy.map((message) => message.conversation))]
    .map((id) => ctx.db.get('conversations', id)))
  const shared = new Set(conversations.flatMap((thread) => {
    if (!thread) return []
    const other = thread.owner === recipient ? thread.requester : thread.requester === recipient ? thread.owner : null
    return other === sender ? [thread._id] : []
  }))
  return [...messages, ...legacy.filter((message) => shared.has(message.conversation))].slice(0, limit)
}

export const getConversation = query({
  args: { threadId: v.string(), includeMessages: v.optional(v.boolean()) },
  returns: v.union(v.null(), v.object({
    id: v.id('conversations'), offerId: v.id('offers'), number: v.number(), person: v.id('collectors'), name: v.string(), blocked: v.boolean(), historyVersion: v.optional(v.number()),
    inbox: v.optional(v.array(incoming)),
    offer: v.optional(offerValidator),
  })),
  handler: async (ctx, { threadId, includeMessages }) => {
    const me = await currentCollector(ctx)
    const id = ctx.db.normalizeId('conversations', threadId)
    const thread = id && await ctx.db.get('conversations', id)
    if (!me || !thread || (thread.owner !== me._id && thread.requester !== me._id)) return null
    if (thread[threadFields(thread, me._id).hidden]) return null
    const view = threadView(thread, me._id)
    const person = await ctx.db.get('collectors', view.person)
    if (!person || person.deleting) return null
    const [blocked, pending, offer] = await Promise.all([
      messageBlock(ctx, me._id, view.person),
      includeMessages ? ctx.db.query('unreadMessages').withIndex('by_recipient_and_conversation', (q) =>
        q.eq('recipient', me._id).eq('conversation', thread._id)).take(inboxLimit) : undefined,
      includeMessages ? ctx.db.get('offers', thread.offer) : null,
    ])
    const interested = offer && thread.requester === me._id && await interestFor(ctx, offer._id, me._id)
    return {
      ...view,
      name: person.displayName,
      blocked: !!blocked,
      inbox: pending?.map((message) => inboxMessage(message, view.historyVersion)),
      offer: offer ? {
        id: offer._id, number: offer.number, owner: offer.owner === me._id ? 'me' : offer.owner,
        interested: interested ? ['me'] : [],
        promisedTo: offer.promisedTo === me._id ? 'me' : offer.status === 'promised' ? 'reserved' : null,
      } : undefined,
    }
  },
})

type MarkStatus = 'wanted' | 'owned' | 'double' | 'clear'

async function markNumbers(ctx: MutationCtx, me: Doc<'collectors'>, input: number[], status: MarkStatus, mode: 'edit' | 'batch') {
  const numbers = validNumbers(input)
  const offers = await ownOffers(ctx, me._id)
  const offered = new Set(offers.map((offer) => offer.number))
  const protectedNumbers = status === 'wanted' || status === 'clear' ? numbers.filter((number) => offered.has(number)) : []
  if (mode === 'edit' && protectedNumbers.length) {
    throw new ConvexError(`Haal deze nummers eerst uit je aanbod: ${protectedNumbers.join(', ')}.`)
  }

  const changed = numbers.filter((number) => {
    if (status === 'double') return mode === 'edit' || !offered.has(number)
    if (status === 'clear') return !!me.album[number] && !offered.has(number)
    return me.album[number] !== status && (status !== 'wanted' || !offered.has(number))
  })
  if (status === 'double' && offers.length + changed.length > offerLimit) throw new ConvexError('Je aanbod zit vol.')
  if (!changed.length) return { changed: 0, protectedCount: protectedNumbers.length }

  const album = { ...me.album }
  for (const number of changed) {
    if (status === 'clear') delete album[number]
    else album[number] = status === 'double' ? 'owned' : status
    if (status === 'double') await ctx.db.insert('offers', { owner: me._id, number, status: 'available', interestedCount: 0, hadInterest: false })
  }
  await ctx.db.patch('collectors', me._id, { album })
  return { changed: changed.length, protectedCount: protectedNumbers.length }
}

export const markAlbum = mutation({
  args: batchAlbumArgs,
  returns: v.object({ changed: v.number(), protectedCount: v.number() }),
  handler: async (ctx, { scope, status }) => markNumbers(ctx, await requireCollector(ctx), scope, status, 'batch'),
})

async function conversationFor(ctx: MutationCtx, offer: Doc<'offers'>, requester: Id<'collectors'>, viewer: Id<'collectors'>) {
  const existing = await ctx.db.query('conversations').withIndex('by_offer_and_requester',
    (q) => q.eq('offer', offer._id).eq('requester', requester)).unique()
  if (existing) {
    await showConversation(ctx, existing, viewer)
    return existing._id
  }
  const now = Date.now()
  return await ctx.db.insert('conversations', {
    offer: offer._id, number: offer.number, owner: offer.owner, requester,
    ownerVisibleSince: now, requesterVisibleSince: now,
  })
}

async function showConversation(ctx: MutationCtx, thread: Doc<'conversations'>, viewer: Id<'collectors'>) {
  const { hidden, visibleSince } = threadFields(thread, viewer)
  if (thread[hidden]) {
    await ctx.db.patch('conversations', thread._id, { [hidden]: undefined, [visibleSince]: Date.now() })
  }
}

async function interestFor(ctx: MutationCtx | QueryCtx, offer: Id<'offers'>, collector: Id<'collectors'>) {
  return ctx.db.query('interests').withIndex('by_offer_and_collector', (q) => q.eq('offer', offer).eq('collector', collector)).unique()
}

async function clearOfferInterests(ctx: MutationCtx, offer: Id<'offers'>) {
  const interests = await ctx.db.query('interests').withIndex('by_offer_and_collector',
    (q) => q.eq('offer', offer)).take(interestCleanupBatchSize + 1)
  for (const interest of interests.slice(0, interestCleanupBatchSize)) await ctx.db.delete('interests', interest._id)
  if (interests.length > interestCleanupBatchSize) {
    await ctx.scheduler.runAfter(0, internal.exchange.cleanupOfferInterests, { offer })
  }
}

export const cleanupOfferInterests = internalMutation({
  args: { offer: v.id('offers') },
  returns: v.null(),
  handler: async (ctx, { offer }) => {
    await clearOfferInterests(ctx, offer)
    return null
  },
})

export const update = mutation({
  args: { command: exchangeCommand },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { command }) => {
    const me = await requireCollector(ctx)

    if (command.type === 'album') {
      await markNumbers(ctx, me, command.numbers, command.status, 'edit')
      return null
    }
    if (command.type === 'profile') {
      const displayName = command.displayName.trim()
      if (!displayName || displayName.length > 32) throw new ConvexError('Kies een naam van maximaal 32 tekens.')
      await ctx.db.patch('collectors', me._id, {
        displayName,
        digest: command.digest,
        ...(command.district === undefined ? {} : { district: command.district ?? undefined }),
        ...(command.searchDistricts === undefined ? {} : { searchDistricts: uniqueDistricts(command.searchDistricts) }),
      })
      return null
    }
    if (command.type === 'removeThread') {
      const thread = await ctx.db.get('conversations', idFor(ctx, 'conversations', command.threadId))
      if (!thread) return null
      if (thread.owner !== me._id && thread.requester !== me._id) {
        throw new ConvexError('Dit gesprek is niet beschikbaar.')
      }
      const { hidden, version } = threadFields(thread, me._id)
      const currentVersion = thread[version] ?? 0
      if (currentVersion > command.historyVersion) return null
      if (thread[hidden] || currentVersion !== command.historyVersion) {
        throw new ConvexError('Het gesprek is gewijzigd. Open het opnieuw.')
      }
      const unread = await ctx.db.query('unreadMessages').withIndex('by_recipient_and_conversation',
        (q) => q.eq('recipient', me._id).eq('conversation', thread._id)).take(inboxLimit)
      for (const message of unread) await ctx.db.delete('unreadMessages', message._id)
      await ctx.db.patch('conversations', thread._id, { [hidden]: true, [version]: currentVersion + 1 })
      return null
    }
    if (command.type === 'read') {
      const message = await ctx.db.get('unreadMessages', idFor(ctx, 'unreadMessages', command.messageId))
      if (message?.recipient === me._id) await ctx.db.delete('unreadMessages', message._id)
      return null
    }
    if (command.type === 'exampleReply') throw new ConvexError('Stuur een bericht vanaf het andere proefaccount.')
    if (command.type === 'removeDouble') {
      if (command.confirmInterest && !command.offerId) throw new ConvexError('Kies eerst welk exemplaar je wilt verwijderen.')
      if (command.offerId !== undefined) {
        const copy = await ctx.db.get('offers', idFor(ctx, 'offers', command.offerId))
        if (!copy) return null
        if (copy.owner !== me._id || copy.number !== command.number) throw new ConvexError('Dit exemplaar is niet meer beschikbaar.')
        if (copy.status !== 'available') throw new ConvexError('Geef dit exemplaar eerst vrij bij ‘Mijn aanbod’.')
        if (copy.interestedCount > 0 && !command.confirmInterest) {
          throw new ConvexError('Iemand heeft interesse. Bevestig dat je dit aanbod wilt intrekken.')
        }
        await ctx.db.delete('offers', copy._id)
        await clearOfferInterests(ctx, copy._id)
        return null
      }

      const copies = await ctx.db.query('offers').withIndex('by_owner_and_number',
        (q) => q.eq('owner', me._id).eq('number', command.number)).take(offerLimit)
      const free = copies.find((copy) => copy.status === 'available' && copy.interestedCount === 0)
      if (!free) throw new ConvexError('Dit exemplaar heeft al interesse of is beloofd.')
      await ctx.db.delete('offers', free._id)
      return null
    }

    const offer = await ctx.db.get('offers', idFor(ctx, 'offers', command.offerId))
    if (!offer) throw new ConvexError('Dit exemplaar is niet meer beschikbaar.')
    if (command.type === 'want') {
      const owner = await ctx.db.get('collectors', offer.owner)
      if (!owner || owner.deleting) throw new ConvexError('Dit exemplaar is niet beschikbaar.')
      const interest = await interestFor(ctx, offer._id, me._id)
      if (offer.owner === me._id || (!interest && offer.status !== 'available')) throw new ConvexError('Dit exemplaar is niet beschikbaar.')
      if (!interest) {
        await ctx.db.insert('interests', { offer: offer._id, owner: offer.owner, collector: me._id, number: offer.number })
        await ctx.db.patch('offers', offer._id, { interestedCount: offer.interestedCount + 1, hadInterest: true })
      }
      return await conversationFor(ctx, offer, me._id, me._id)
    }
    if (command.type === 'withdraw') {
      if (offer.promisedTo === me._id) throw new ConvexError('Vraag de eigenaar om het exemplaar vrij te geven.')
      const interest = await interestFor(ctx, offer._id, me._id)
      if (interest) {
        await ctx.db.delete('interests', interest._id)
        await ctx.db.patch('offers', offer._id, { interestedCount: offer.interestedCount - 1, hadInterest: true })
      }
      return null
    }

    if (offer.owner !== me._id) throw new ConvexError('Alleen de eigenaar kan dit exemplaar beheren.')
    if ((command.type === 'finish' || (command.type === 'promise' && command.person === null)) &&
        (!command.expectedRecipient || offer.promisedTo !== command.expectedRecipient)) {
      throw new ConvexError('De afspraak is gewijzigd. Open het aanbod opnieuw.')
    }
    if (command.type === 'finish') {
      const recipient = offer.promisedTo && await ctx.db.get('collectors', offer.promisedTo)
      if (!recipient || recipient.deleting) throw new ConvexError('De afspraak is gewijzigd. Open het aanbod opnieuw.')
      await ctx.db.delete('offers', offer._id)
      await clearOfferInterests(ctx, offer._id)
      return null
    }
    if (command.type === 'promise' && command.person === null) {
      await ctx.db.patch('offers', offer._id, { status: 'available', promisedTo: undefined })
      return null
    }
    if (command.person === null) return null
    const person = idFor(ctx, 'collectors', command.person)
    const requester = await ctx.db.get('collectors', person)
    if (!requester || requester.deleting) throw new ConvexError('Deze verzamelaar heeft geen interesse meer.')
    if (!await interestFor(ctx, offer._id, person)) throw new ConvexError('Deze verzamelaar heeft geen interesse meer.')
    if (command.type === 'openThread') return await conversationFor(ctx, offer, person, me._id)
    if (offer.status === 'promised') {
      if (offer.promisedTo === person) return null
      throw new ConvexError('Dit exemplaar is al beloofd.')
    }
    await ctx.db.patch('offers', offer._id, { status: 'promised', promisedTo: person })
    return null
  },
})

export const setMessageBlock = mutation({
  args: { threadId: v.id('conversations'), blocked: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { threadId, blocked }) => {
    const me = await requireCollector(ctx)
    const thread = await ctx.db.get('conversations', threadId)
    if (!thread || (thread.owner !== me._id && thread.requester !== me._id)) {
      throw new ConvexError('Dit gesprek is niet beschikbaar.')
    }
    const person = threadView(thread, me._id).person
    const profile = await ctx.db.get('collectors', person)
    if (!profile || profile.deleting) throw new ConvexError('Dit gesprek is niet beschikbaar.')
    const existing = await messageBlock(ctx, me._id, person)
    if (!blocked) {
      if (existing) await ctx.db.delete('messageBlocks', existing._id)
      return null
    }
    if (!existing) await ctx.db.insert('messageBlocks', { blocker: me._id, blocked: person })
    for (const message of await messagesFrom(ctx, me._id, person, inboxLimit)) {
      await ctx.db.delete('unreadMessages', message._id)
    }
    return null
  },
})

export const send = mutation({
  args: { threadId: v.string(), clientId: v.string(), text: v.string(), composedAt: v.number(), historyVersion: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { threadId, clientId, text, composedAt, historyVersion }) => {
    const me = await requireCollector(ctx)
    const conversation = await ctx.db.get('conversations', idFor(ctx, 'conversations', threadId))
    if (!conversation || (conversation.owner !== me._id && conversation.requester !== me._id)) {
      throw new ConvexError('Dit gesprek is niet beschikbaar.')
    }
    const sender = threadFields(conversation, me._id)
    if (conversation[sender.hidden] || (conversation[sender.version] ?? 0) !== (historyVersion ?? 0)) {
      throw new ConvexError('Het gesprek is gewijzigd. Open het opnieuw.')
    }
    const body = text.trim()
    if (!body || body.length > 1000 || !/^[\da-f-]{36}$/u.test(clientId)) throw new ConvexError('Gebruik een bericht van maximaal 1.000 tekens.')
    const seen = await ctx.db.query('messageDeliveries').withIndex('by_sender_and_clientId',
      (q) => q.eq('sender', me._id).eq('clientId', clientId)).unique()
    if (seen) return null
    const age = Date.now() - composedAt
    if (!Number.isFinite(age) || age > resendWindowMs || age < -60_000) {
      throw new ConvexError('Dit bericht is verlopen. Je kunt de tekst kopiëren naar een nieuw bericht.')
    }
    const recipient = conversation.owner === me._id ? conversation.requester : conversation.owner
    const collector = await ctx.db.get('collectors', recipient)
    if (!collector || collector.deleting) throw new ConvexError('Dit gesprek is niet beschikbaar.')
    const [blockedByRecipient, blockedBySender] = await Promise.all([
      messageBlock(ctx, recipient, me._id),
      messageBlock(ctx, me._id, recipient),
    ])
    if (blockedByRecipient || blockedBySender) throw new ConvexError('Je kunt in dit gesprek geen berichten sturen.')
    if ((await messagesFrom(ctx, recipient, me._id, unreadPerSender)).length >= unreadPerSender) {
      throw new ConvexError('Je hebt al 5 ongelezen berichten bij deze verzamelaar. Wacht tot die je berichten heeft gelezen.')
    }
    const queued = await ctx.db.query('unreadMessages').withIndex('by_recipient', (q) => q.eq('recipient', recipient)).take(inboxLimit)
    if (queued.length >= inboxLimit) throw new ConvexError('De inbox van deze verzamelaar zit vol. Probeer het later opnieuw.')
    await ctx.db.insert('unreadMessages', { conversation: conversation._id, recipient, sender: me._id, text: body })
    await recordMessageForReplyFilter(ctx, me._id, recipient)
    const expiry = await ctx.db.query('unreadExpiry').unique()
    if (!expiry) await scheduleUnreadExpiry(ctx, null)
    await showConversation(ctx, conversation, recipient)
    const delivery = await ctx.db.insert('messageDeliveries', { sender: me._id, clientId, conversation: conversation._id })
    await ctx.scheduler.runAfter(resendWindowMs + 60_000, internal.exchange.forgetDelivery, { delivery })
    return null
  },
})

export const forgetDelivery = internalMutation({
  args: { delivery: v.id('messageDeliveries') },
  returns: v.null(),
  handler: async (ctx, { delivery }) => {
    if (await ctx.db.get('messageDeliveries', delivery)) await ctx.db.delete('messageDeliveries', delivery)
    return null
  },
})

async function scheduleUnreadExpiry(ctx: MutationCtx, expiry: Doc<'unreadExpiry'> | null) {
  const oldest = await ctx.db.query('unreadMessages').withIndex('by_creation_time').first()
  if (!oldest) {
    if (expiry) await ctx.db.delete('unreadExpiry', expiry._id)
    return
  }
  const dueAt = oldest._creationTime + unreadRetentionMs
  if (expiry) await ctx.db.patch('unreadExpiry', expiry._id, { dueAt })
  else await ctx.db.insert('unreadExpiry', { dueAt })
  await ctx.scheduler.runAt(Math.max(Date.now(), dueAt), internal.exchange.expireUnreadMessages, { dueAt })
}

export const expireUnreadMessages = internalMutation({
  args: { dueAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { dueAt }) => {
    const expiry = await ctx.db.query('unreadExpiry').unique()
    const now = Date.now()
    if (dueAt !== undefined ? expiry?.dueAt !== dueAt : expiry && expiry.dueAt > now) return null
    const expired = await ctx.db.query('unreadMessages').withIndex('by_creation_time',
      (q) => q.lte('_creationTime', now - unreadRetentionMs)).take(expiryBatchSize)
    for (const message of expired) await ctx.db.delete('unreadMessages', message._id)
    await scheduleUnreadExpiry(ctx, expiry)
    return null
  },
})

export const backfillInterestNumbers = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query('interests').paginate({ cursor: cursor ?? null, numItems: 100 })
    for (const interest of page.page) {
      if (interest.number !== undefined) continue
      const offer = await ctx.db.get('offers', interest.offer)
      if (offer) await ctx.db.patch('interests', interest._id, { number: offer.number })
      else await ctx.db.delete('interests', interest._id)
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.exchange.backfillInterestNumbers, { cursor: page.continueCursor })
    return null
  },
})
