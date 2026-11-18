import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { api } from '../convex/_generated/api'

export type DemoState = NonNullable<FunctionReturnType<typeof api.demo.get>>
export type Command = FunctionArgs<typeof api.demo.update>['command']
export type Offer = DemoState['offers'][number]
export type Thread = DemoState['threads'][number]
export type Update = (command: Command, options?: { inlineError?: boolean }) => Promise<string | null>

export function errorMessage(error: unknown) {
  return error instanceof ConvexError && typeof error.data === 'string'
    ? error.data
    : 'Opslaan is niet gelukt. Probeer het nog eens.'
}

export const albumSize = 175
export const catalog = Array.from({ length: albumSize }, (_, index) => index + 1)

const people: Record<string, { name: string; initials: string; wants: number[] }> = {
  noor: { name: 'Noor V.', initials: 'NV', wants: [12, 57] },
  sam: { name: 'Sam B.', initials: 'SB', wants: [57] },
  fatima: { name: 'Fatima D.', initials: 'FD', wants: [41, 80] },
  eva: { name: 'Eva P.', initials: 'EP', wants: [12, 23] },
}

export function personFor(id: string) {
  return people[id] ?? { name: 'Jij', initials: 'JI', wants: [] }
}

const samples: Record<number, string> = { 34: 'Water', 80: 'Knooppunten', 126: 'Thuis', 151: 'Samenleven' }
export function themeFor(number: number) {
  return samples[number]
}

export function myOffers(state: DemoState, number?: number) {
  return state.offers.filter((offer) => offer.owner === 'me' && (number === undefined || offer.number === number))
}

export function interestLabel(count: number) {
  return count === 1 ? '1 geïnteresseerde' : `${count} geïnteresseerden`
}

export function parseStickerNumbers(input: string) {
  const entries = input.trim().split(/[\s,;]+/u)
  const numbers = entries.map((entry) => /^\d{1,3}$/u.test(entry) ? Number(entry) : NaN)
  if (numbers.some((number) => !Number.isInteger(number) || number < 1 || number > albumSize)) return null
  return [...new Set(numbers)]
}

export function localDemoKey() {
  const storageKey = 'stickerruil.local-demo'
  const saved = localStorage.getItem(storageKey)
  if (saved && /^[\da-f-]{36}$/u.test(saved)) return saved
  const key = crypto.randomUUID()
  localStorage.setItem(storageKey, key)
  return key
}
