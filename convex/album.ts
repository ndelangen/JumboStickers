import { ConvexError, v } from 'convex/values'

export const albumLength = 175
export const offerLimit = 400
export const batchAlbumArgs = {
  scope: v.array(v.number()),
  status: v.union(v.literal('wanted'), v.literal('double')),
}

export function validNumbers(input: number[]) {
  const numbers = [...new Set(input)]
  if (!numbers.length || numbers.length > albumLength ||
      numbers.some((number) => !Number.isInteger(number) || number < 1 || number > albumLength)) {
    throw new ConvexError(`Gebruik stickernummers van 1 tot en met ${albumLength}.`)
  }
  return numbers
}
