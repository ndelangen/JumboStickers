import { catalogData } from './catalogData'

export const themes = ['Inleiding', 'Water', 'Knooppunten', 'Thuis', 'Samenleven'] as const
type Theme = typeof themes[number]

type Sticker = {
  number: number
  page: number
  title: string
  theme: Theme
  section: string
}

// The last sticker number in each section comes from the checklist on page 70.
const sections: readonly (readonly [last: number, theme: Theme, title: string])[] = [
  [4, 'Inleiding', 'Wat houdt Zwolle bij elkaar?'],
  [10, 'Inleiding', 'Dit is waar je Zwolle waarschijnlijk van kent'],
  [16, 'Water', 'Van afvoerputje naar superspons'],
  [22, 'Water', 'Zwolle, stad niet aan de IJssel'],
  [28, 'Water', 'Handel en vermaak'],
  [34, 'Water', 'Rampspoed'],
  [39, 'Water', 'Johannes Ter Pelkwijk'],
  [45, 'Water', 'Openluchtbad'],
  [50, 'Water', 'We zwemmen nog'],
  [55, 'Water', 'Waterbeheer anno nu'],
  [59, 'Knooppunten', 'Bruggen bouw je niet zomaar'],
  [67, 'Knooppunten', 'Station als kruispunt'],
  [73, 'Knooppunten', 'Zwolle fietsstad'],
  [78, 'Knooppunten', 'De brugcommissie'],
  [85, 'Knooppunten', 'IJsselbrug'],
  [91, 'Knooppunten', 'Passerelle'],
  [95, 'Knooppunten', 'Metaforische brug'],
  [99, 'Thuis', 'Voor iedereen een thuis?'],
  [114, 'Thuis', 'Wonen in Zwolle'],
  [119, 'Thuis', 'Wonen door de tijd: van stad naar groen'],
  [124, 'Thuis', 'Wonen in armoede: hulp en onderdak'],
  [128, 'Thuis', 'Het Vrouwenhuis'],
  [134, 'Thuis', 'Groeten uit Zwolle'],
  [138, 'Samenleven', 'Samenleven, hoe doe je dat?'],
  [155, 'Samenleven', 'De wijken van Zwolle'],
  [160, 'Samenleven', 'Verenigen door de twintigste eeuw heen'],
  [166, 'Samenleven', 'Jeugdwerk toen: Jeugdland en Celecentrum'],
  [171, 'Samenleven', 'Jeugdwerk nu: plekken, begeleiding en talent'],
  [175, 'Samenleven', 'Buurtinitiatieven en ontmoetingsplekken'],
]

export const catalog = catalogData.map(([number, page, title]): Sticker => {
  const section = sections.find(([last]) => number <= last)
  if (!section) throw new Error(`Sticker ${number} has no section.`)
  return { number, page, title, theme: section[1], section: section[2] }
})

export const albumSize = catalog.length
const stickersByNumber = new Map(catalog.map((sticker) => [sticker.number, sticker]))

export function stickerFor(number: number) {
  return stickersByNumber.get(number)
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function matchesSticker(sticker: Sticker, query: string) {
  const search = normalize(query).trim()
  if (!search) return true
  if (/^\d+$/u.test(search)) return String(sticker.number).includes(search.replace(/^0+(?=\d)/u, ''))
  const index = normalize(`${sticker.title} ${sticker.theme} ${sticker.section}`)
  return search.split(/\s+/u).every((word) => index.includes(word))
}
