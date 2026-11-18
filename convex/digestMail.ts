import { unsubscribePath } from '../shared/digestLinks'

export function composeDigest(site: string, { numbers, unreadCount, unsubscribeToken }: {
  numbers: number[]
  unreadCount: number
  unsubscribeToken: string
}) {
  const text: string[] = []
  const html: string[] = []
  const hasTrades = numbers.length > 0

  if (unreadCount) {
    const count = unreadCount === 1 ? '1 ongelezen bericht' : `${unreadCount} ongelezen berichten`
    const inbox = `${site}/berichten`
    text.push(count, `Bekijk Berichten: ${inbox}`)
    html.push(`<p>${count}<br><a href="${inbox}">Bekijk Berichten</a></p>`)
  }

  if (hasTrades) {
    const intro = 'Voor deze stickers die je zoekt is een exemplaar vrij waar nog niemand om heeft gevraagd.'
    const unsubscribe = `${site}${unsubscribePath}#${unsubscribeToken}`
    const links = [...numbers].sort((a, b) => a - b).map((number) => ({
      label: `Sticker ${number}`,
      href: `${site}/ruilen?sticker=${number}#aanbod`,
    }))
    text.push(intro, links.map(({ label, href }) => `${label}: ${href}`).join('\n'), `Afmelden voor ruilmails: ${unsubscribe}`)
    html.push(`<p>${intro}</p><ul>${links.map(({ label, href }) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul><p><a href="${unsubscribe}">Afmelden voor ruilmails</a></p>`)
  }

  const subject = unreadCount ? (hasTrades ? 'Je dagelijkse overzicht van Stickerruil Zwolle' : 'Ongelezen berichten op Stickerruil Zwolle') : 'Nieuwe ruilkansen in Zwolle'
  return { subject, body: text.join('\n\n'), htmlBody: html.join('') }
}
