import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { v } from 'convex/values'
import { mergedStream, stream } from 'convex-helpers/server/stream'
import type { Doc } from './_generated/dataModel'
import { query, type QueryCtx } from './_generated/server'
import { offerLimit, validNumbers } from './album'
import { currentCollector } from './collectors'
import { districtValidator, searchDistrictsValidator } from './districts'
import schema, { offer } from './schema'

const pageSizeLimit = 48
const rowsPerPageLimit = 512
const listing = v.object({
  offer, displayName: v.string(), district: v.optional(districtValidator), canTrade: v.boolean(),
})

function indexedOffers(ctx: QueryCtx, numbers: number[] | null) {
  const offers = stream(ctx.db, schema).query('offers')
  if (numbers === null) return offers.withIndex('by_status_and_number', (q) => q.eq('status', 'available'))
  if (numbers.length === 1) {
    return offers.withIndex('by_status_and_number', (q) => q.eq('status', 'available').eq('number', numbers[0]))
  }

  const ranges: { first: number, last: number }[] = []
  for (const number of [...numbers].sort((a, b) => a - b)) {
    const previous = ranges.at(-1)
    if (previous?.last === number - 1) previous.last = number
    else ranges.push({ first: number, last: number })
  }
  const streams = ranges.map(({ first, last }) => offers.withIndex('by_status_and_number', (q) =>
    q.eq('status', 'available').gte('number', first).lte('number', last),
  ))
  return streams.length === 1 ? streams[0] : mergedStream(streams, ['number', 'interestedCount', '_creationTime'])
}

export const list = query({
  args: {
    filter: v.union(v.literal('available'), v.literal('interest')),
    numbers: v.union(v.null(), v.array(v.number())),
    districts: searchDistrictsValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listing),
  handler: async (ctx, { filter, numbers, districts, paginationOpts }) => {
    const collector = await currentCollector(ctx)
    if (!collector || numbers?.length === 0) return { page: [], isDone: true, continueCursor: '' }

    const { _id: viewer, album } = collector
    const scope = numbers === null ? null : validNumbers(numbers)
    const wantedNumbers = scope === null ? null : new Set(scope)
    const ownOffers = await ctx.db.query('offers').withIndex('by_owner', (q) => q.eq('owner', viewer)).take(offerLimit)
    const tradableNumbers = new Set(ownOffers.filter((item) => item.status === 'available').map((item) => item.number))
    const profiles = new Map<Doc<'collectors'>['_id'], Promise<Doc<'collectors'> | null>>()

    const selectedDistricts = new Set(filter === 'available' ? districts : [])

    async function marketListing(item: Doc<'offers'>, knownInterest = false) {
      let profile = profiles.get(item.owner)
      if (!profile) {
        profile = ctx.db.get('collectors', item.owner)
        profiles.set(item.owner, profile)
      }
      const owner = await profile
      if (!owner || owner.deleting || (selectedDistricts.size && (!owner.district || !selectedDistricts.has(owner.district)))) return null
      const interested = knownInterest || !!await ctx.db.query('interests').withIndex('by_offer_and_collector',
        (q) => q.eq('offer', item._id).eq('collector', viewer)).unique()
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
        canTrade: item.status === 'available' && album[item.number] === 'wanted' &&
          [...tradableNumbers].some((number) => owner.album[number] === 'wanted'),
      }
    }

    const options = {
      ...paginationOpts,
      numItems: Math.max(1, Math.min(pageSizeLimit, Math.floor(paginationOpts.numItems) || 1)),
      maximumRowsRead: rowsPerPageLimit,
    }
    if (filter === 'interest') {
      return stream(ctx.db, schema).query('interests').withIndex('by_collector', (q) => q.eq('collector', viewer))
        .map(async (interest) => {
          const item = await ctx.db.get('offers', interest.offer)
          return item && item.owner !== viewer && (!wantedNumbers || wantedNumbers.has(item.number)) ? marketListing(item, true) : null
        }).paginate(options)
    }
    return indexedOffers(ctx, scope)
      .map(async (item) => item.owner === viewer ? null : marketListing(item))
      .paginate(options)
  },
})
