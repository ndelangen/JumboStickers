import { v } from 'convex/values'

// https://www.zwolle.nl/wijken
export const districts = [
  'Aa-landen',
  'Assendorp',
  'Berkum',
  'Binnenstad',
  'Diezerpoort',
  'Haerst-Tolhuislanden',
  'Hanzeland',
  'Holtenbroek',
  'Kamperpoort',
  'Spoolde',
  'Stadshagen',
  'Veerallee',
  'Westenholte',
  'Wijthmen',
  'Windesheim',
  'Wipstrik',
  'Zwolle-Zuid',
] as const

export type District = (typeof districts)[number]

export const districtValidator = v.union(...districts.map((district) => v.literal(district)))
export const searchDistrictsValidator = v.array(districtValidator)

export function uniqueDistricts(selection: readonly string[]): District[] {
  return districts.filter((district) => selection.includes(district))
}
