import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'

const origin = 'https://stickerruil-zwolle.netlify.app'
const api = 'https://api.netlify.com/api/v1'
const siteId = process.env.NETLIFY_SITE_ID
const token = process.env.NETLIFY_AUTH_TOKEN
const commit = process.env.GITHUB_SHA
const dryRun = process.argv.includes('--dry-run')
const assetPath = /^\/assets\/[A-Za-z0-9._-]+\.(?:js|css|woff2?)$/u
const retentionMs = 7 * 24 * 60 * 60 * 1000

assert.match(siteId ?? '', /^[0-9a-f-]{36}$/u, 'Set the production Netlify site ID.')
assert(token, 'Set the production Netlify deploy token.')
assert.match(commit ?? '', /^[0-9a-f]{40}$/u, 'Set the commit SHA.')

function sha(bytes) {
  return createHash('sha1').update(bytes).digest('hex')
}

function request(url, options = {}) {
  return fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000), ...options })
}

async function netlify(path, options = {}) {
  const response = await request(api + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (!response.ok) {
    const { error, message } = await response.json().catch(() => ({}))
    throw new Error(`Netlify rejected ${options.method ?? 'GET'} ${path} (${response.status}). ${error ?? message ?? ''}`)
  }
  return response.json()
}

async function liveFile(host, path) {
  const response = await request(host + path)
  assert(response.ok, `Could not read ${path} from ${host} (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

async function keepPreviousAssets(previous, current, directory) {
  // The first Actions deploy starts from a manual deploy with no release manifest.
  const files = await netlify(`/sites/${siteId}/files`)
  const now = Date.now()
  let paths = files.map(({ path }) => path).filter((path) => assetPath.test(path))
  const retention = new Map()
  const host = `https://${previous.id}--stickerruil-zwolle.netlify.app`
  if (files.some(({ path }) => path === '/release.json')) {
    const release = JSON.parse(await liveFile(host, '/release.json'))
    assert(Array.isArray(release.assets) && release.assets.every((path) => assetPath.test(path)), 'Invalid asset paths in the previous release manifest.')
    paths = release.assets
    for (const [path, until] of release.retained ?? []) {
      assert(assetPath.test(path) && Number.isFinite(until), 'Invalid retained asset in the previous release manifest.')
      if (until > now) retention.set(path, until)
    }
  }
  for (const path of paths) retention.set(path, now + retentionMs)
  for (const path of current.keys()) retention.delete(path)

  const digests = new Map(files.map(({ path, sha: hash }) => [path, hash]))
  for (const path of retention.keys()) {
    const bytes = await liveFile(host, path)
    assert.equal(sha(bytes), digests.get(path), `Previous file checksum changed for ${path}.`)
    await writeFile(directory + path, bytes)
  }
  return { retention, hashes: [...retention.keys()].map((path) => [path, digests.get(path)]) }
}

async function waitForPublication(id) {
  for (let attempt = 0; attempt < 18; attempt++) {
    const [deploy, site] = await Promise.all([netlify(`/deploys/${id}`), netlify(`/sites/${siteId}`)])
    if (deploy.state === 'error') throw new Error(deploy.error_message ?? 'Netlify failed to process the deploy.')
    if (deploy.state === 'ready' && site.published_deploy?.id === id) return
    await setTimeout(5_000)
  }
  throw new Error(`Netlify did not publish deployment ${id}.`)
}

async function confirmLive(commit, entry, assets) {
  // Static assets have unique names. The HTML and release marker may take a moment to propagate.
  for (let attempt = 0; attempt < 12; attempt++) {
    const marker = await request(`${origin}/release.json?commit=${commit}`, { headers: { 'Cache-Control': 'no-cache' } })
    if (marker.ok && marker.headers.get('content-type')?.includes('application/json') && (await marker.json()).commit === commit) {
      const pages = await Promise.all(['/ruilen', '/instellingen', '/privacy'].map(async (path) =>
        (await liveFile(origin, `${path}?commit=${commit}`)).toString()))
      if (pages.every((html) => html.includes(`src="${entry}"`))) {
        await Promise.all([...assets].map(async ([path, hash]) =>
          assert.equal(sha(await liveFile(origin, path)), hash, `Live asset checksum differs for ${path}.`)))
        return
      }
    }
    await setTimeout(5_000)
  }
  throw new Error('The live routes did not serve the published release.')
}

const site = await netlify(`/sites/${siteId}`)
assert.equal(site.ssl_url, origin, 'The configured site ID does not belong to Stickerruil Zwolle.')
const previous = site.published_deploy
assert.match(previous?.id ?? '', /^[0-9a-f]{24}$/u, 'Could not identify the currently published deploy.')

const directory = await mkdtemp(join(tmpdir(), 'stickerruil-release-'))
try {
  const payload = join(directory, 'site')
  await cp('dist', payload, { recursive: true })
  const html = await readFile(join(payload, 'index.html'), 'utf8')
  const entry = html.match(/src="(\/assets\/[^"]+\.js)"/u)?.[1]
  const current = new Map()
  for (const name of await readdir(join(payload, 'assets'))) {
    const path = `/assets/${name}`
    if (assetPath.test(path)) current.set(path, sha(await readFile(payload + path)))
  }
  assert(current.has(entry), 'Missing the built JavaScript entry.')
  const retained = await keepPreviousAssets(previous, current, payload)
  await writeFile(join(payload, 'release.json'), JSON.stringify({
    commit, assets: [...current.keys()], retained: [...retained.retention],
  }))
  const archive = join(directory, 'site.zip')
  execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: payload, stdio: 'inherit' })
  console.log(`Prepared ${current.size} current and ${retained.hashes.length} retained assets.`)

  if (!dryRun) {
    const branch = await request(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/git/ref/heads/main`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
    })
    assert(branch.ok, 'Could not verify the current main commit.')
    if ((await branch.json()).object.sha !== commit) {
      console.log('Skipped publication because main advanced.')
    } else {
      const latest = await netlify(`/sites/${siteId}`)
      assert.equal(latest.published_deploy?.id, previous.id, 'The published deploy changed while the release was being prepared.')
      const deploy = await netlify(`/sites/${siteId}/deploys?title=${encodeURIComponent(`GitHub Actions: ${commit}`)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: await readFile(archive),
      })
      assert.match(deploy.id ?? '', /^[0-9a-f]{24}$/u, 'Netlify did not return a deploy ID.')
      console.log(`Netlify accepted deploy ${deploy.id}.`)
      await waitForPublication(deploy.id)
      await confirmLive(commit, entry, [...current, ...retained.hashes])
      const summary = `Verified Netlify deploy ${deploy.id} at ${origin} for ${commit}.\n`
      console.log(summary.trim())
      if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
