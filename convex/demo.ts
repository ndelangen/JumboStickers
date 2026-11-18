import { ConvexError, v, type Infer } from 'convex/values'
import { mutation, query } from './_generated/server'
import { albumStatus, demoStateFields } from './schema'
import { albumLength, offerLimit, validNumbers } from './album'
import { localOrigin } from './localOrigin'

const stateValidator = v.object(demoStateFields)
type State = Infer<typeof stateValidator>

export const exchangeCommand = v.union(
  v.object({ type: v.literal('album'), numbers: v.array(v.number()), status: v.union(albumStatus, v.literal('double'), v.literal('clear')) }),
  v.object({ type: v.literal('removeDouble'), number: v.number() }),
  v.object({ type: v.literal('want'), offerId: v.string() }),
  v.object({ type: v.literal('withdraw'), offerId: v.string() }),
  v.object({ type: v.literal('promise'), offerId: v.string(), person: v.union(v.string(), v.null()), expectedRecipient: v.optional(v.string()) }),
  v.object({ type: v.literal('finish'), offerId: v.string(), expectedRecipient: v.optional(v.string()) }),
  v.object({ type: v.literal('openThread'), offerId: v.string(), person: v.string() }),
  v.object({ type: v.literal('read'), messageId: v.string() }),
  v.object({ type: v.literal('exampleReply'), threadId: v.string() }),
  v.object({ type: v.literal('profile'), displayName: v.string(), digest: v.boolean() }),
)

function verifyKey(key: string) {
  if (!localOrigin() || !/^[\da-f-]{36}$/u.test(key)) {
    throw new ConvexError('Deze voorbeeldomgeving is alleen lokaal beschikbaar.')
  }
}

const seed: State = {
  album: { ...Object.fromEntries(Array.from({ length: 25 }, (_, index) => [index + 1, 'owned'])),
    34: 'wanted', 57: 'owned', 80: 'wanted', 126: 'wanted', 151: 'wanted' },
  displayName: 'Jij',
  digest: false,
  offers: [
    { id: 'noor-34', number: 34, owner: 'noor', interested: [], promisedTo: null },
    { id: 'sam-80', number: 80, owner: 'sam', interested: ['noor'], promisedTo: null },
    { id: 'fatima-126', number: 126, owner: 'fatima', interested: ['sam'], promisedTo: 'sam' },
    { id: 'eva-151', number: 151, owner: 'eva', interested: [], promisedTo: null },
    { id: 'noor-57', number: 57, owner: 'noor', interested: [], promisedTo: null },
    { id: 'sam-18', number: 18, owner: 'sam', interested: [], promisedTo: null },
    { id: 'mijn-12', number: 12, owner: 'me', interested: ['noor', 'eva'], promisedTo: null },
    { id: 'mijn-57', number: 57, owner: 'me', interested: [], promisedTo: null },
  ],
  threads: [{ id: 'mijn-12-noor', offerId: 'mijn-12', number: 12, person: 'noor' }],
  inbox: [{ id: 'welkom-noor', threadId: 'mijn-12-noor', text: 'Hoi! Ik zoek sticker 12. Ik heb 34 dubbel. Zullen we ruilen?', sentAt: 0 }],
}

export const get = query({
  args: { key: v.string() },
  returns: v.union(stateValidator, v.null()),
  handler: async (ctx, { key }) => {
    verifyKey(key)
    const row = await ctx.db.query('demoAlbums').withIndex('by_key', (q) => q.eq('key', key)).unique()
    if (!row) return null
    const { album, offers, threads, inbox, displayName, digest } = row
    return { album, offers, threads, inbox, displayName, digest }
  },
})

export const start = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    verifyKey(key)
    const existing = await ctx.db.query('demoAlbums').withIndex('by_key', (q) => q.eq('key', key)).unique()
    if (!existing) await ctx.db.insert('demoAlbums', { key, ...seed })
    return null
  },
})

function threadWith(threads: State['threads'], offer: State['offers'][number], person: string) {
  const id = `${offer.id}-${person}`
  if (!threads.some((thread) => thread.id === id)) threads.unshift({ id, offerId: offer.id, number: offer.number, person })
  return id
}

function newOffer(number: number): State['offers'][number] {
  return { id: crypto.randomUUID(), number, owner: 'me', interested: [], promisedTo: null }
}

export const markAlbum = mutation({
  args: {
    key: v.string(),
    scope: v.union(v.literal('all'), v.literal('empty'), v.array(v.number())),
    status: v.union(albumStatus, v.literal('double')),
  },
  returns: v.object({ changed: v.number(), protectedCount: v.number() }),
  handler: async (ctx, { key, scope, status }) => {
    verifyKey(key)
    const row = await ctx.db.query('demoAlbums').withIndex('by_key', (q) => q.eq('key', key)).unique()
    if (!row) throw new ConvexError('Open de voorbeeldomgeving opnieuw.')
    const { album, offers } = row
    const offered = new Set(offers.filter((offer) => offer.owner === 'me').map((offer) => offer.number))
    const numbers = typeof scope === 'string'
      ? Array.from({ length: albumLength }, (_, index) => index + 1)
      : validNumbers(scope)
    const matching = scope === 'empty' ? numbers.filter((number) => !album[number] && !offered.has(number)) : numbers
    const protectedCount = status === 'wanted' ? matching.filter((number) => offered.has(number)).length : 0
    const changed = matching.filter((number) => {
      if (status === 'double') return typeof scope !== 'string' || !offered.has(number)
      return album[number] !== status && (status !== 'wanted' || !offered.has(number))
    })
    if (status === 'double' && offers.length + changed.length > offerLimit) {
      throw new ConvexError('Je voorbeeldalbum zit vol.')
    }
    for (const number of changed) album[number] = status === 'double' ? 'owned' : status
    if (status === 'double') offers.unshift(...changed.map(newOffer))
    if (changed.length) await ctx.db.patch(row._id, { album, offers })
    return { changed: changed.length, protectedCount }
  },
})

export const update = mutation({
  args: { key: v.string(), command: exchangeCommand },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { key, command: change }) => {
    verifyKey(key)
    const row = await ctx.db.query('demoAlbums').withIndex('by_key', (q) => q.eq('key', key)).unique()
    if (!row) throw new ConvexError('Open de voorbeeldomgeving opnieuw.')
    const { album, offers, threads, inbox } = row
    let result: string | null = null

    if (change.type === 'album') {
      const numbers = validNumbers(change.numbers)
      const doubles = new Set(offers.filter((offer) => offer.owner === 'me').map((offer) => offer.number))
      const stillOffered = numbers.filter((number) => doubles.has(number))
      if ((change.status === 'wanted' || change.status === 'clear') && stillOffered.length) {
        throw new ConvexError(`Haal deze nummers eerst uit je aanbod: ${stillOffered.join(', ')}.`)
      }
      if (change.status === 'double' && offers.length + numbers.length > offerLimit) throw new ConvexError('Je voorbeeldalbum zit vol.')
      for (const number of numbers) {
        if (change.status === 'clear') delete album[number]
        else if (change.status === 'double') {
          album[number] = 'owned'
          offers.unshift(newOffer(number))
        } else album[number] = change.status
      }
      await ctx.db.patch(row._id, { album, offers })
      return null
    }

    if (change.type === 'removeDouble') {
      const index = offers.findIndex((offer) => offer.owner === 'me' && offer.number === change.number &&
        !offer.promisedTo && offer.interested.length === 0)
      if (index === -1) throw new ConvexError('Dit exemplaar heeft al interesse of is beloofd.')
      offers.splice(index, 1)
      await ctx.db.patch(row._id, { offers })
      return null
    }

    if (change.type === 'profile') {
      const displayName = change.displayName.trim()
      if (!displayName || displayName.length > 32) throw new ConvexError('Kies een naam van maximaal 32 tekens.')
      await ctx.db.patch(row._id, { displayName, digest: change.digest })
      return null
    }

    if (change.type === 'read') {
      await ctx.db.patch(row._id, { inbox: inbox.filter((message) => message.id !== change.messageId) })
      return null
    }

    if (change.type === 'exampleReply') {
      const existing = threads.find((thread) => thread.id === change.threadId)
      if (!existing) throw new ConvexError('Dit gesprek bestaat niet.')
      if (inbox.length >= 50) throw new ConvexError('Open eerst een paar ongelezen voorbeeldberichten.')
      inbox.push({ id: crypto.randomUUID(), threadId: existing.id, text: 'Leuk! Zullen we bij de ingang van de bibliotheek afspreken?', sentAt: Date.now() })
      await ctx.db.patch(row._id, { inbox })
      return null
    }

    const offer = offers.find((item) => item.id === change.offerId)
    if (!offer) throw new ConvexError('Dit exemplaar is niet meer beschikbaar.')
    if ((change.type === 'finish' || (change.type === 'promise' && change.person === null)) &&
        change.expectedRecipient && offer.promisedTo !== change.expectedRecipient) {
      throw new ConvexError('De afspraak is gewijzigd. Open het aanbod opnieuw.')
    }

    switch (change.type) {
      case 'want':
        if (offer.owner === 'me' || offer.promisedTo) throw new ConvexError('Dit exemplaar is niet beschikbaar.')
        if (!offer.interested.includes('me')) offer.interested.push('me')
        result = threadWith(threads, offer, offer.owner)
        break
      case 'withdraw':
        if (offer.promisedTo === 'me') throw new ConvexError('Vraag de eigenaar om het exemplaar vrij te geven.')
        offer.interested = offer.interested.filter((person) => person !== 'me')
        break
      case 'promise':
        if (offer.owner !== 'me') throw new ConvexError('Alleen de eigenaar kan dit exemplaar beloven.')
        if (change.person && (offer.promisedTo || !offer.interested.includes(change.person))) {
          throw new ConvexError('Dit exemplaar is al beloofd of de persoon heeft geen interesse meer.')
        }
        offer.promisedTo = change.person
        break
      case 'finish':
        if (offer.owner !== 'me' || !offer.promisedTo) throw new ConvexError('Beloof het exemplaar eerst aan iemand.')
        offers.splice(offers.indexOf(offer), 1)
        break
      case 'openThread':
        if (offer.owner !== 'me' || !offer.interested.includes(change.person)) throw new ConvexError('Dit verzoek bestaat niet.')
        result = threadWith(threads, offer, change.person)
        break
    }

    await ctx.db.patch(row._id, { offers, threads })
    return result
  },
})
