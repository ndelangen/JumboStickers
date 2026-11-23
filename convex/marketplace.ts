import { paginationOptsValidator, paginationResultValidator, type PaginationResult } from 'convex/server'
import { v, type Infer } from 'convex/values'
import { EmptyStream, mergedStream, SingletonStream, stream } from 'convex-helpers/server/stream'
import type { Doc } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import { offerLimit, validNumbers } from './album'
import { currentCollector } from './collectors'
import { districtValidator, searchDistrictsValidator } from './districts'
import { isWaitingForReply } from './replyWaits'
import schema, { offer } from './schema'

const pageSizeLimit = 48
const rowsPerPageLimit = 512
const offerOrder = ['number', 'interestedCount', '_creationTime', '_id']
const listing = v.object({
  offer, displayName: v.string(), district: v.optional(districtValidator), canTrade: v.boolean(),
})

function indexedOffers(ctx: QueryCtx, numbers: number[] | null, status: Doc<'offers'>['status']) {
  const offers = stream(ctx.db, schema).query('offers')
  if (numbers === null) return offers.withIndex('by_status_and_number', (q) => q.eq('status', status))
  if (numbers.length === 1) {
    return offers.withIndex('by_status_and_number', (q) => q.eq('status', status).eq('number', numbers[0]))
  }

  const ranges: { first: number, last: number }[] = []
  for (const number of [...numbers].sort((a, b) => a - b)) {
    const previous = ranges.at(-1)
    if (previous?.last === number - 1) previous.last = number
    else ranges.push({ first: number, last: number })
  }
  const streams = ranges.map(({ first, last }) => offers.withIndex('by_status_and_number', (q) =>
    q.eq('status', status).gte('number', first).lte('number', last),
  ))
  return streams.length === 1 ? streams[0] : mergedStream(streams, offerOrder)
}

export const list = query({
  args: {
    filter: v.union(v.literal('available'), v.literal('interest')),
    numbers: v.union(v.null(), v.array(v.number())),
    districts: searchDistrictsValidator,
    prioritizeMatches: v.optional(v.boolean()),
    hideUnanswered: v.optional(v.boolean()),
    indexedInterests: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listing),
  handler: async (ctx, { filter, numbers, districts, prioritizeMatches, hideUnanswered, indexedInterests, paginationOpts }) => {
    const collector = await currentCollector(ctx)
    if (!collector || numbers?.length === 0) return { page: [], isDone: true, continueCursor: '' }

    const { _id: viewer, album } = collector
    const scope = numbers === null ? null : validNumbers(numbers)
    const ownOffers = await ctx.db.query('offers').withIndex('by_owner', (q) => q.eq('owner', viewer)).take(offerLimit)
    const tradableNumbers = [...new Set(ownOffers.filter((item) => item.status === 'available').map((item) => item.number))]
    const profiles = new Map<Doc<'collectors'>['_id'], Promise<Doc<'collectors'> | null>>()
    const replyWaits = new Map<Doc<'collectors'>['_id'], Promise<boolean>>()

    const selectedDistricts = new Set(filter === 'available' ? districts : [])

    async function hasInterest(item: Doc<'offers'>) {
      return !!await ctx.db.query('interests').withIndex('by_offer_and_collector',
        (q) => q.eq('offer', item._id).eq('collector', viewer)).unique()
    }

    async function marketListing(item: Doc<'offers'>, knownInterest = false, matchFilter?: boolean) {
      let profile = profiles.get(item.owner)
      if (!profile) {
        profile = ctx.db.get('collectors', item.owner)
        profiles.set(item.owner, profile)
      }
      const owner = await profile
      if (!owner || owner.deleting || (selectedDistricts.size && (!owner.district || !selectedDistricts.has(owner.district)))) return null
      const canTrade = item.status === 'available' && album[item.number] === 'wanted' &&
        tradableNumbers.some((number) => owner.album[number] === 'wanted')
      if (matchFilter !== undefined && canTrade !== matchFilter) return null
      if (filter === 'available' && hideUnanswered) {
        let waiting = replyWaits.get(item.owner)
        if (!waiting) {
          waiting = isWaitingForReply(ctx, viewer, item.owner)
          replyWaits.set(item.owner, waiting)
        }
        if (await waiting) return null
      }
      const interested = knownInterest || (item.interestedCount > 0 && await hasInterest(item))
      return {
        offer: {
          id: item._id,
          number: item.number,
          owner: item.owner,
          interested: interested ? ['me'] : [],
          interestCount: item.interestedCount,
          promisedTo: item.promisedTo === viewer ? 'me' : item.status === 'promised' ? 'reserved' : null,
        },
        displayName: owner.displayName,
        district: owner.district,
        canTrade,
      }
    }

    const options = {
      ...paginationOpts,
      numItems: Math.max(1, Math.min(pageSizeLimit, Math.floor(paginationOpts.numItems) || 1)),
      maximumRowsRead: rowsPerPageLimit,
    }
    const available = indexedOffers(ctx, scope, 'available')
    if (filter === 'interest') {
      const boundary = indexedInterests ? options.cursor ?? options.endCursor : null
      const useInterestIndex = indexedInterests && (boundary
        ? boundary.startsWith('i:')
        : !await ctx.db.query('interests').withIndex('by_collector_and_number', (q) =>
          q.eq('collector', viewer).eq('number', undefined)).first())
      const interestOptions = indexedInterests ? {
        ...options,
        cursor: options.cursor ? options.cursor.slice(2) : null,
        endCursor: options.endCursor ? options.endCursor.slice(2) : options.endCursor,
      } : options
      const prefix = useInterestIndex ? 'i:' : 'o:'
      function withInterestCursor(result: PaginationResult<Infer<typeof listing>>) {
        if (!indexedInterests) return result
        return {
          ...result,
          continueCursor: prefix + result.continueCursor,
          ...(result.splitCursor ? { splitCursor: prefix + result.splitCursor } : {}),
        }
      }
      if (useInterestIndex) {
        const numbers = scope && new Set(scope)
        const result = await stream(ctx.db, schema).query('interests')
          .withIndex('by_collector_and_number', (q) => q.eq('collector', viewer))
          .map(async (item) => {
            if (item.number === undefined || (numbers && !numbers.has(item.number))) return null
            const offer = await ctx.db.get('offers', item.offer)
            return offer && offer.owner !== viewer ? marketListing(offer, true) : null
          }).paginate(interestOptions)
        return withInterestCursor(result)
      }
      const interest = await ctx.db.query('interests').withIndex('by_collector', (q) => q.eq('collector', viewer)).first()
      if (!interest) return { page: [], isDone: true, continueCursor: '' }
      const promised = indexedOffers(ctx, scope, 'promised')
      const result = await mergedStream([available, promised], offerOrder)
        .map(async (item) => {
          if (item.owner === viewer || item.interestedCount === 0 || !await hasInterest(item)) return null
          return marketListing(item, true)
        })
        .paginate(interestOptions)
      return withInterestCursor(result)
    }
    if (prioritizeMatches) {
      const wanted = tradableNumbers.length
        ? (scope ?? Object.keys(album).map(Number)).filter((number) => album[number] === 'wanted')
        : []
      // Use a composite cursor so both tiers can paginate in sticker-number order.
      const tierOrder = ['_id']
      const tiers = mergedStream([true, false].map((matches) => {
        const key = [matches ? '0-matches' : '1-other']
        return new SingletonStream({ matches }, 'asc', tierOrder, key, key)
      }), tierOrder)
      return tiers.flatMap<Infer<typeof listing>>(async ({ matches }) => {
        if (matches && !wanted.length) return new EmptyStream('asc', offerOrder)
        const candidates = matches ? indexedOffers(ctx, wanted, 'available') : available
        return mergedStream([candidates], offerOrder)
          .map(async (item) => item.owner === viewer ? null : marketListing(item, false, matches))
      }, offerOrder).paginate(options)
    }
    return available
      .map(async (item) => item.owner === viewer ? null : marketListing(item))
      .paginate(options)
  },
})
