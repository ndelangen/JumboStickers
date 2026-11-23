import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { districtValidator, searchDistrictsValidator } from './districts'

export const albumStatus = v.union(v.literal('wanted'), v.literal('owned'))

export const offer = v.object({
  id: v.string(),
  number: v.number(),
  owner: v.string(),
  interested: v.array(v.string()),
  interestCount: v.optional(v.number()),
  promisedTo: v.union(v.string(), v.null()),
})

export const thread = v.object({
  id: v.string(),
  offerId: v.string(),
  number: v.number(),
  person: v.string(),
  historyVersion: v.optional(v.number()),
})

export const incoming = v.object({ id: v.string(), threadId: v.string(), text: v.string(), sentAt: v.number(), historyVersion: v.optional(v.number()) })

export const demoStateFields = {
  album: v.record(v.string(), albumStatus),
  offers: v.array(offer),
  threads: v.array(thread),
  inbox: v.array(incoming),
  displayName: v.string(),
  district: v.optional(districtValidator),
  searchDistricts: v.optional(searchDistrictsValidator),
  digest: v.boolean(),
}

export default defineSchema({
  demoAlbums: defineTable({ key: v.string(), ...demoStateFields }).index('by_key', ['key']),
  collectors: defineTable({
    identity: v.string(),
    displayName: v.string(),
    district: v.optional(districtValidator),
    searchDistricts: v.optional(searchDistrictsValidator),
    hideUnanswered: v.optional(v.boolean()),
    hideBlocked: v.optional(v.boolean()),
    digest: v.boolean(),
    album: v.record(v.string(), albumStatus),
    deleting: v.optional(v.boolean()),
    unreadReminderSeen: v.optional(v.boolean()),
    localHistoryById: v.optional(v.boolean()),
  }).index('by_identity', ['identity']),
  offers: defineTable({
    owner: v.id('collectors'),
    number: v.number(),
    status: v.union(v.literal('available'), v.literal('promised')),
    interestedCount: v.number(),
    hadInterest: v.optional(v.boolean()),
    promisedTo: v.optional(v.id('collectors')),
  })
    .index('by_status', ['status'])
    .index('by_status_and_number', ['status', 'number', 'interestedCount'])
    .index('by_owner', ['owner'])
    .index('by_promisedTo', ['promisedTo'])
    .index('by_status_and_interestedCount', ['status', 'interestedCount'])
    .index('by_owner_and_number', ['owner', 'number']),
  interests: defineTable({
    offer: v.id('offers'),
    owner: v.id('collectors'),
    collector: v.id('collectors'),
    number: v.optional(v.number()),
  })
    .index('by_offer_and_collector', ['offer', 'collector'])
    .index('by_collector', ['collector'])
    .index('by_collector_and_number', ['collector', 'number'])
    .index('by_owner', ['owner']),
  conversations: defineTable({
    offer: v.id('offers'),
    number: v.number(),
    owner: v.id('collectors'),
    requester: v.id('collectors'),
    ownerHidden: v.optional(v.literal(true)),
    requesterHidden: v.optional(v.literal(true)),
    ownerVisibleSince: v.optional(v.number()),
    requesterVisibleSince: v.optional(v.number()),
    ownerHistoryVersion: v.optional(v.number()),
    requesterHistoryVersion: v.optional(v.number()),
  })
    .index('by_offer_and_requester', ['offer', 'requester'])
    .index('by_owner', ['owner'])
    .index('by_requester', ['requester'])
    .index('by_owner_and_ownerHidden_and_ownerVisibleSince', ['owner', 'ownerHidden', 'ownerVisibleSince'])
    .index('by_requester_and_requesterHidden_and_requesterVisibleSince', ['requester', 'requesterHidden', 'requesterVisibleSince']),
  unreadMessages: defineTable({
    conversation: v.id('conversations'),
    recipient: v.id('collectors'),
    sender: v.optional(v.id('collectors')),
    text: v.string(),
  })
    .index('by_recipient_and_sender', ['recipient', 'sender'])
    .index('by_recipient', ['recipient'])
    .index('by_recipient_and_conversation', ['recipient', 'conversation'])
    .index('by_conversation', ['conversation']),
  unreadExpiry: defineTable({ dueAt: v.number() }),
  messageBlocks: defineTable({
    blocker: v.id('collectors'),
    blocked: v.id('collectors'),
  })
    .index('by_blocker_and_blocked', ['blocker', 'blocked'])
    .index('by_blocked', ['blocked']),
  messageDeliveries: defineTable({
    sender: v.id('collectors'),
    clientId: v.string(),
    conversation: v.optional(v.id('conversations')),
  }).index('by_sender_and_clientId', ['sender', 'clientId']).index('by_conversation', ['conversation']),
  replyWaits: defineTable({
    first: v.id('collectors'),
    second: v.id('collectors'),
    sender: v.id('collectors'),
    overdue: v.boolean(),
    deadlineJob: v.optional(v.id('_scheduled_functions')),
  }).index('by_first_and_second', ['first', 'second']).index('by_second', ['second']),
  digestSubscriptions: defineTable({
    collector: v.id('collectors'),
    email: v.string(),
    unsubscribeToken: v.string(),
    tradesEnabled: v.optional(v.boolean()),
    unreadEnabled: v.optional(v.boolean()),
    lastSent: v.optional(v.string()),
  }).index('by_collector', ['collector']).index('by_unsubscribeToken', ['unsubscribeToken']).index('by_lastSent', ['lastSent']),
  digestRounds: defineTable({
    date: v.string(), cursor: v.union(v.null(), v.string()), dispatched: v.number(), finished: v.boolean(),
  }).index('by_date', ['date']),
  digestAttempts: defineTable({
    collector: v.id('collectors'),
    date: v.string(),
  }).index('by_collector_and_date', ['collector', 'date']),
  digestNotices: defineTable({
    collector: v.id('collectors'),
    offer: v.id('offers'),
  }).index('by_collector_and_offer', ['collector', 'offer']),
})
