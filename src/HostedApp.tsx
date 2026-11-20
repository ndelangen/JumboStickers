import { AuthProvider, Descope, getRefreshToken, getSessionToken, useDescope, useSession } from '@descope/react-sdk'
import { Alert, Anchor, Button, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { ConvexProviderWithAuth, useConvexAuth, useMutation, useQuery, type ConvexReactClient } from 'convex/react'
import { Mail } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../convex/_generated/api'
import { App, FinishAccountRemoval, PublicPolicyFallback } from './App'
import type { Update } from './demo'
import { SignupProfile, UnreadReminderBanner } from './pages/AccountPages'
import { EmptyState, PageHeading, PhotoCredit } from './ui'
import { OfferCover, requestedSticker } from './pages/OffersPage'

type DescopeConfig = { projectId: string, baseUrl: string, flowId: string }
const redirectPath = '/inloggen'
const sender = 'noreply@descope.io'
const removalStorageKey = 'stickerruil.account-verwijderen'
type Removal = { collectorId: string, subject: string, committed: boolean }

function pendingRemoval() {
  try {
    return JSON.parse(localStorage.getItem(removalStorageKey) ?? 'null') as Removal | null
  } catch {
    return null
  }
}

function useHostedAuth() {
  const { isAuthenticated, isSessionLoading } = useSession()
  const { refresh } = useDescope()
  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    try {
      if (forceRefreshToken) return (await refresh()).data?.sessionJwt ?? null
      return getSessionToken() || null
    } catch { return null }
  }, [refresh])
  return { isLoading: isSessionLoading, isAuthenticated, fetchAccessToken }
}

function hasMagicLink() {
  const query = new URLSearchParams(location.search)
  return query.has('t') || query.has('descope-login-flow') || query.has('code')
}

function wantsInbox() {
  return location.pathname === '/berichten' ||
    (location.pathname === redirectPath && new URLSearchParams(location.search).get('na') === 'berichten')
}

const inboxLoginPath = `${redirectPath}?na=berichten`

function Login({ flowId, onVerified }: { flowId: string, onVerified: () => void }) {
  const [failed, setFailed] = useState(false)
  const number = requestedSticker()
  const returnPath = wantsInbox() ? inboxLoginPath : number ? `${redirectPath}?sticker=${number}` : redirectPath

  return <>
    <section className="sign-in">
      <div className="sign-in-photo" aria-hidden="true" />
      <Paper className="sign-in-form" radius={0} p="xl">
        <Stack>
          <div className="mail-sticker" aria-hidden><Mail size={28} /></div>
          {new URLSearchParams(location.search).get('account') === 'verwijderd' &&
            <Alert color="olive" role="status">Je Stickerruil-account is gesloten. Je bent uitgelogd.</Alert>}
          <PageHeading title="Inloggen om te ruilen" />
          <Text>Vul je e-mailadres in. Je krijgt een link waarmee je meteen inlogt. Je hebt geen wachtwoord nodig.</Text>
          <Text>De mail komt van <strong>{sender}</strong>. De link werkt één keer en is vijf minuten geldig.</Text>
          <Text size="sm" c="dimmed">Andere verzamelaars zien je e-mailadres nooit. Lees hoe we je gegevens gebruiken in de <Anchor href="/privacy">privacyverklaring</Anchor>.</Text>
          {failed ? <Alert color="red" title="Inloggen is niet gelukt">
            <Stack>
              <Text>Vraag een nieuwe inloglink aan als je link verlopen of al gebruikt is.</Text>
              <Button component="a" href={returnPath} data-reload>Vraag een nieuwe link aan</Button>
            </Stack>
          </Alert> : (
            <Descope flowId={flowId} locale="nl" redirectUrl={location.origin + returnPath}
              onSuccess={() => {
                history.replaceState(history.state, '', returnPath)
                onVerified()
              }}
              onError={() => {
                history.replaceState(history.state, '', returnPath)
                setFailed(true)
              }}
              errorTransformer={({ text }) => /verify token|expired|already used/i.test(text)
                ? 'Deze link werkt niet meer. Vraag een nieuwe inloglink aan.' : text} />
          )}
        </Stack>
      </Paper>
    </section>
    <div className="sign-in-credit"><PhotoCredit /></div>
  </>
}

function HostedExchange({ flowId }: { flowId: string }) {
  const [checkingLink, setCheckingLink] = useState(hasMagicLink)
  const [logoutError, setLogoutError] = useState(false)
  const [removal, setRemoval] = useState(pendingRemoval)
  const session = useSession()
  const { logout } = useDescope()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const state = useQuery(api.exchange.get, isAuthenticated ? { view: 'shell' } : 'skip')
  const subject = session.claims?.sub
  const collectorId = state?.collectorId
  const register = useMutation(api.account.registerOwn)
  const mutate = useMutation(api.exchange.update)
  const markAlbum = useMutation(api.exchange.markAlbum)
  const sendMessage = useMutation(api.exchange.send)
  const erase = useMutation(api.account.eraseOwn)
  const update = useCallback<Update>((command) => mutate({ command }), [mutate])

  useEffect(() => {
    function syncRemoval(event: StorageEvent) {
      if (event.key !== removalStorageKey) return
      const pending = pendingRemoval()
      setRemoval((current) => pending ?? (current?.committed ? current : null))
    }
    window.addEventListener('storage', syncRemoval)
    return () => window.removeEventListener('storage', syncRemoval)
  }, [])

  const eraseAccount = async () => {
    if (!collectorId || !subject) throw new Error('Account removal requires a collector ID and session subject.')
    const pending = { collectorId, subject, committed: false }
    localStorage.setItem(removalStorageKey, JSON.stringify(pending))
    setRemoval(pending)
    try {
      await erase({ expected: collectorId })
    } catch (cause) {
      localStorage.removeItem(removalStorageKey)
      setRemoval(null)
      throw cause
    }
    const committed = { ...pending, committed: true }
    localStorage.setItem(removalStorageKey, JSON.stringify(committed))
    setRemoval(committed)
    return null
  }

  const erased = removal?.committed || (state === null && removal?.subject === subject) ? removal : null
  const erasedId = erased?.collectorId
  const sameSession = !!subject && subject === erased?.subject
  const finishRemoval = useCallback(async () => {
    if (!subject && getRefreshToken()) throw new Error()
    if (sameSession && (getSessionToken() || getRefreshToken())) {
      await logout()
      if (getSessionToken() || getRefreshToken()) throw new Error()
    }
    if (pendingRemoval()?.collectorId === erasedId) localStorage.removeItem(removalStorageKey)
  }, [erasedId, logout, sameSession, subject])

  if (erasedId) {
    if (session.isSessionLoading) return <PublicPolicyFallback>
      <Group className="loading" role="status"><Loader size="sm" /><Text>Even je sessie controleren…</Text></Group>
    </PublicPolicyFallback>
    return <FinishAccountRemoval historyKey={`hosted:${erasedId}`} signOut={finishRemoval}
      donePath={subject && !sameSession ? '/instellingen' : undefined} />
  }
  const signOut = async () => {
    setLogoutError(false)
    try {
      const result = await logout()
      if (!result.ok) throw new Error()
      location.replace(redirectPath)
    } catch { setLogoutError(true) }
  }
  const login = <Login flowId={flowId} onVerified={() => setCheckingLink(false)} />
  const number = requestedSticker()
  const signIn = checkingLink ? login : state ? <EmptyState title="Je bent ingelogd"
    action={wantsInbox() ? <Button component="a" href="/berichten">Bekijk mijn berichten</Button> :
      number ? <Button component="a" href={`/ruilen?sticker=${number}#aanbod`} data-reload>Bekijk sticker {number}</Button> :
      <Button component="a" href="/album">Open mijn album</Button>}>Je kunt nu stickers ruilen.</EmptyState> :
    state === null ? <SignupProfile register={register} /> :
    session.isSessionLoading || isLoading || isAuthenticated ?
      <Group className="loading" role="status"><Loader size="sm" /><Text>Even je account openen…</Text></Group> :
      session.isAuthenticated ? <EmptyState title="Je sessie kon niet worden geopend"
        action={<Button onClick={() => void signOut()}>Log opnieuw in</Button>}>Vraag een nieuwe inloglink aan.</EmptyState> :
        login
  return <App state={state} commit={update} markAlbum={markAlbum} historyKey={state ? `hosted:${state.collectorId}` : ''}
    connected={isAuthenticated} sendMessage={state ? sendMessage : undefined} eraseAccount={state ? eraseAccount : undefined}
    hosted={{ signIn, landing: !isLoading && !session.isSessionLoading && !session.isAuthenticated ?
      <><OfferCover signedIn={false} /><PhotoCredit /></> : undefined, notice: <>
      {state && session.isAuthenticated && <UnreadReminderBanner key={state.collectorId} />}
      {logoutError && <Alert className="app-error" role="alert" color="red">
      Uitloggen is niet gelukt. Probeer het opnieuw.
    </Alert>}</>, placeholder: isAuthenticated || isLoading ? signIn : <EmptyState title="Ruil mee met Stickerruil Zwolle"
      action={wantsInbox() ? <Button component="a" href={inboxLoginPath} data-reload>Inloggen om berichten te lezen</Button> :
        <Button component="a" href={redirectPath}>Ik wil ook stickers ruilen</Button>}>Log in met een eenmalige link in je e-mail.</EmptyState>,
    logout: session.isAuthenticated ? () => void signOut() : undefined }} />
}

export function HostedApp({ client, config }: { client: ConvexReactClient, config: DescopeConfig }) {
  return <AuthProvider projectId={config.projectId} baseUrl={config.baseUrl} autoRefresh storeLastAuthenticatedUser={false}>
    <ConvexProviderWithAuth client={client} useAuth={useHostedAuth}>
      <HostedExchange flowId={config.flowId} />
    </ConvexProviderWithAuth>
  </AuthProvider>
}
