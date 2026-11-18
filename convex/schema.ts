import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const albumStatus = v.union(v.literal('wanted'), v.literal('owned'))

export const offer = v.object({
  id: v.string(),
  number: v.number(),
  owner: v.string(),
  interested: v.array(v.string()),
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
})
