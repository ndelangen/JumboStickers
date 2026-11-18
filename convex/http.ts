import { httpRouter } from 'convex/server'
import { api } from './_generated/api'
import { httpAction } from './_generated/server'
import { isUnsubscribeToken, unsubscribePath } from '../shared/digestLinks'

const http = httpRouter()
const path = '/ruilmail/afmelden'

function response(text: string, status = 200) {
  return new Response(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stickerruil Zwolle</title><main><h1>Ruilmail</h1>${text}</main></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
  })
}

http.route({
  path, method: 'GET',
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get('token')
    if (!isUnsubscribeToken(token)) return response('<p>Deze afmeldlink klopt niet.</p>', 400)
    const site = process.env.DIGEST_SITE_URL
    if (site && /^https:\/\/[\w.-]+$/u.test(site)) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${site}${unsubscribePath}#${token}`, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
      })
    }
    return response(`<p>Wil je geen mails meer over nieuwe ruilkansen?</p><form method="post"><input name="token" type="hidden" value="${token}"><button type="submit">Meld me af</button></form>`)
  }),
})

http.route({
  path, method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const form = await req.formData().catch(() => null)
    const token = form?.get('token')
    if (!isUnsubscribeToken(token)) return response('<p>Deze afmeldlink klopt niet.</p>', 400)
    const removed = await ctx.runMutation(api.digest.unsubscribe, { token })
    return removed ? response('<p>Je bent afgemeld voor ruilmails.</p>') :
      response('<p>Deze afmeldlink is verlopen of al gebruikt. Je kunt je voorkeur aanpassen in Instellingen.</p>')
  }),
})

export default http
