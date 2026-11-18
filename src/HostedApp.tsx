import { AuthProvider, Descope, getSessionToken, useDescope, useSession } from '@descope/react-sdk'
import { Alert, Button, Group, Loader, Paper, Stack, Text, TextInput } from '@mantine/core'
import { ConvexProviderWithAuth, useConvexAuth, useMutation, useQuery, type ConvexReactClient } from 'convex/react'
import { Mail } from 'lucide-react'
import { useCallback, useState } from 'react'
import { api } from '../convex/_generated/api'
import { App } from './App'
import { errorMessage, type Update } from './demo'
import { EmptyState, PageHeading, PhotoCredit } from './ui'

type DescopeConfig = { projectId: string, baseUrl: string, flowId: string }
const redirectPath = '/inloggen'
const sender = 'noreply@descope.io'

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

function Login({ flowId, onVerified }: { flowId: string, onVerified: () => void }) {
  const [failed, setFailed] = useState(false)

  return <>
    <section className="sign-in">
      <div className="sign-in-photo" aria-hidden="true" />
      <Paper className="sign-in-form" radius={0} p="xl">
        <Stack>
          <div className="mail-sticker" aria-hidden><Mail size={28} /></div>
          <PageHeading title="Inloggen om te ruilen" />
          <Text>Vul je e-mailadres in. Je krijgt een link waarmee je meteen inlogt. Je hebt geen wachtwoord nodig.</Text>
          <Text>De mail komt van <strong>{sender}</strong>. De link werkt één keer en is vijf minuten geldig.</Text>
          <Text size="sm" c="dimmed">Andere verzamelaars zien je e-mailadres nooit.</Text>
          {failed ? <Alert color="red" title="Inloggen is niet gelukt">
            <Stack>
              <Text>Vraag een nieuwe inloglink aan als je link verlopen of al gebruikt is.</Text>
              <Button component="a" href={redirectPath} data-reload>Vraag een nieuwe link aan</Button>
            </Stack>
          </Alert> : (
            <Descope flowId={flowId} locale="nl" redirectUrl={location.origin + redirectPath}
              onSuccess={() => {
                history.replaceState(history.state, '', redirectPath)
                onVerified()
              }}
              onError={() => {
                history.replaceState(history.state, '', redirectPath)
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

function ChooseName() {
  const register = useMutation(api.account.registerOwn)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <Paper component="form" withBorder p="xl" className="local-accounts" onSubmit={async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try { await register({ displayName: name }) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }}>
    <Stack>
      <PageHeading title="Kies je schermnaam" />
      <Text>Je bent ingelogd. Andere verzamelaars zien alleen de naam die je hier kiest.</Text>
      <TextInput label="Schermnaam" maxLength={32} required value={name} onChange={(event) => setName(event.currentTarget.value)} />
      {error && <Text role="alert" c="red">{error}</Text>}
      <Button type="submit" loading={saving} disabled={!name.trim()}>Verder naar Stickerruil</Button>
    </Stack>
  </Paper>
}

function HostedExchange({ flowId }: { flowId: string }) {
  const [checkingLink, setCheckingLink] = useState(hasMagicLink)
  const [logoutError, setLogoutError] = useState(false)
  const session = useSession()
  const { logout } = useDescope()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const state = useQuery(api.exchange.get, isAuthenticated ? {} : 'skip')
  const mutate = useMutation(api.exchange.update)
  const markAlbum = useMutation(api.exchange.markAlbum)
  const sendMessage = useMutation(api.exchange.send)
  const update = useCallback<Update>((command) => mutate({ command }), [mutate])
  const signOut = async () => {
    setLogoutError(false)
    try {
      const result = await logout()
      if (!result.ok) throw new Error()
      location.replace(redirectPath)
    } catch { setLogoutError(true) }
  }
  const login = <Login flowId={flowId} onVerified={() => setCheckingLink(false)} />
  const signIn = checkingLink ? login : state ? <EmptyState title="Je bent ingelogd"
    action={<Button component="a" href="/album">Open mijn album</Button>}>Je kunt nu stickers ruilen.</EmptyState> :
    state === null ? <ChooseName /> :
    session.isSessionLoading || isLoading || isAuthenticated ?
      <Group className="loading" role="status"><Loader size="sm" /><Text>Even je account openen…</Text></Group> :
      session.isAuthenticated ? <EmptyState title="Je sessie kon niet worden geopend"
        action={<Button onClick={() => void signOut()}>Log opnieuw in</Button>}>Vraag een nieuwe inloglink aan.</EmptyState> :
        login
  return <App state={state} commit={update} markAlbum={markAlbum} historyKey={state ? `hosted:${state.collectorId}` : ''}
    sendMessage={state ? sendMessage : undefined}
    hosted={{ signIn, notice: logoutError ? <Alert className="app-error" role="alert" color="red">
      Uitloggen is niet gelukt. Probeer het opnieuw.
    </Alert> : undefined, placeholder: isAuthenticated || isLoading ? signIn : <EmptyState title="Ruil mee met Stickerruil Zwolle"
      action={<Button component="a" href={redirectPath}>Ik wil ook stickers ruilen</Button>}>Log in met een eenmalige link in je e-mail.</EmptyState>,
    logout: session.isAuthenticated ? () => void signOut() : undefined }} />
}

export function HostedApp({ client, config }: { client: ConvexReactClient, config: DescopeConfig }) {
  return <AuthProvider projectId={config.projectId} baseUrl={config.baseUrl} autoRefresh storeLastAuthenticatedUser={false}>
    <ConvexProviderWithAuth client={client} useAuth={useHostedAuth}>
      <HostedExchange flowId={config.flowId} />
    </ConvexProviderWithAuth>
  </AuthProvider>
}
