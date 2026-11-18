import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

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
})

export const incoming = v.object({ id: v.string(), threadId: v.string(), text: v.string(), sentAt: v.number() })

export const demoStateFields = {
  album: v.record(v.string(), albumStatus),
  offers: v.array(offer),
  threads: v.array(thread),
  inbox: v.array(incoming),
  displayName: v.string(),
  digest: v.boolean(),
}

export default defineSchema({
  demoAlbums: defineTable({ key: v.string(), ...demoStateFields }).index('by_key', ['key']),
  collectors: defineTable({
    identity: v.string(),
    displayName: v.string(),
    digest: v.boolean(),
    album: v.record(v.string(), albumStatus),
    deleting: v.optional(v.boolean()),
    localHistoryById: v.optional(v.boolean()),
  }).index('by_identity', ['identity']),
  offers: defineTable({
    owner: v.id('collectors'),
    number: v.number(),
    status: v.union(v.literal('available'), v.literal('promised')),
    interestedCount: v.number(),
    promisedTo: v.optional(v.id('collectors')),
  })
    .index('by_status', ['status'])
    .index('by_owner', ['owner'])
    .index('by_promisedTo', ['promisedTo'])
    .index('by_owner_and_number', ['owner', 'number']),
  interests: defineTable({
    offer: v.id('offers'),
    owner: v.id('collectors'),
    collector: v.id('collectors'),
  })
    .index('by_offer_and_collector', ['offer', 'collector'])
    .index('by_collector', ['collector'])
    .index('by_owner', ['owner']),
  conversations: defineTable({
    offer: v.id('offers'),
    number: v.number(),
    owner: v.id('collectors'),
    requester: v.id('collectors'),
  })
    .index('by_offer_and_requester', ['offer', 'requester'])
    .index('by_owner', ['owner'])
    .index('by_requester', ['requester']),
  unreadMessages: defineTable({
    conversation: v.id('conversations'),
    recipient: v.id('collectors'),
    text: v.string(),
  }).index('by_recipient', ['recipient']).index('by_conversation', ['conversation']),
  messageDeliveries: defineTable({
    sender: v.id('collectors'),
    clientId: v.string(),
    conversation: v.optional(v.id('conversations')),
  }).index('by_sender_and_clientId', ['sender', 'clientId']).index('by_conversation', ['conversation']),
})
