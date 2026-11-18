import { Alert, Anchor, Badge, Button, Group, Loader, Paper, Text, Title, VisuallyHidden } from '@mantine/core'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { ArrowLeftRight, BookOpen, MessageCircle, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { api } from '../convex/_generated/api'
import { errorMessage, localDemoKey, type BulkMark, type DemoState, type SendMessage, type Update } from './demo'
import { clearLocalSession, type LocalSelection } from './LocalAccounts'
import { retireLocalHistory } from './chatStorage'
import { OffersPage } from './pages/OffersPage'
import { AlbumPage } from './pages/AlbumPage'
import { MessagesPage } from './pages/MessagesPage'
import { SettingsPage, SignInPage } from './pages/AccountPages'
import { BrandLink, EmptyState } from './ui'
import { useUnreadMessages } from './useUnreadMessages'

const links = [
  { href: '/ruilen', label: 'Ruilen', icon: ArrowLeftRight },
  { href: '/album', label: 'Mijn album', icon: BookOpen },
  { href: '/berichten', label: 'Berichten', icon: MessageCircle },
  { href: '/instellingen', label: 'Instellingen', icon: Settings },
]

function activeArea(path: string) {
  return path === '/' ? '/ruilen' : '/' + path.split('/')[1]
}

export function DemoApp() {
  const [demoKey] = useState(localDemoKey)
  const state = useQuery(api.demo.get, { key: demoKey })
  const initialize = useMutation(api.demo.start)
  const mutate = useMutation(api.demo.update)
  const mark = useMutation(api.demo.markAlbum)
  const start = useCallback(() => initialize({ key: demoKey }), [demoKey, initialize])
  const update = useCallback<Update>((command) => mutate({ key: demoKey, command }), [demoKey, mutate])
  const markAlbum = useCallback<BulkMark>((args) => mark({ key: demoKey, ...args }), [demoKey, mark])
  return <App state={state} start={start} commit={update} markAlbum={markAlbum} historyKey={demoKey} />
}

export function ExchangeApp({ selection }: { selection: LocalSelection }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const state = useQuery(api.exchange.get, isAuthenticated ? {} : 'skip')
  const mutate = useMutation(api.exchange.update)
  const markAlbum = useMutation(api.exchange.markAlbum)
  const sendMessage = useMutation(api.exchange.send)
  const eraseAccount = useMutation(api.account.eraseOwn)
  const update = useCallback<Update>((command) => mutate({ command }), [mutate])
  if (selection.session && (state === null || (!isLoading && selection.revoked))) {
    return <FinishAccountRemoval historyKey={selection.session.historyKey} signOut={clearLocalSession} />
  }
  return <App state={state} commit={update} markAlbum={markAlbum} eraseAccount={() => eraseAccount({})}
    sendMessage={sendMessage} historyKey={selection.session?.historyKey ?? `local:${selection.account}`}
    authStopped={!isLoading && !isAuthenticated} />
}

export function FinishAccountRemoval({ historyKey, signOut, donePath = '/inloggen?account=verwijderd' }: {
  historyKey: string
  signOut: () => void | Promise<void>
  donePath?: string
}) {
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<'history' | 'signOut' | null>(null)

  useEffect(() => {
    let active = true
    void retireLocalHistory(historyKey).then(async () => {
      if (!active) return
      try {
        await signOut()
        if (active) location.replace(donePath)
      } catch {
        if (active) setFailure('signOut')
      }
    }, () => { if (active) setFailure('history') })
    return () => { active = false }
  }, [attempt, donePath, historyKey, signOut])

  return <main className="site-width loading">
    {failure ? (
      <EmptyState title={failure === 'history' ? 'Chatgeschiedenis wissen is niet gelukt' : 'Uitloggen is niet gelukt'} action={<Button onClick={() => {
        setFailure(null)
        setAttempt((value) => value + 1)
      }}>Opnieuw proberen</Button>}>Je Stickerruil-account is gesloten.</EmptyState>
    ) : <Group role="status"><Loader size="sm" /><Text>We wissen je chatgeschiedenis en loggen je uit…</Text></Group>}
  </main>
}

export function App({ state, start, commit, markAlbum, historyKey, sendMessage, eraseAccount, hosted, authStopped = false }: {
  state: DemoState | null | undefined
  start?: () => Promise<null>
  commit: Update
  markAlbum: BulkMark
  historyKey: string
  sendMessage?: SendMessage
  eraseAccount?: () => Promise<null>
  authStopped?: boolean
  hosted?: { signIn: ReactNode, landing?: ReactNode, placeholder?: ReactNode, notice?: ReactNode, logout?: () => void }
}) {
  const [path, setPath] = useState(location.pathname)
  const [error, setError] = useState('')
  const content = useRef<HTMLElement>(null)
  const shouldFocus = useRef(false)
  const area = activeArea(path)
  const { arrival, unread } = useUnreadMessages(state?.inbox)
  const unreadLabel = unread === 1 ? '1 ongelezen bericht' : `${unread} ongelezen berichten`

  useEffect(() => {
    if (state !== null || !start) return
    void start().catch((cause) => setError(errorMessage(cause)))
  }, [start, state])

  useEffect(() => {
    function followHistory() {
      shouldFocus.current = true
      setPath(location.pathname)
      setError('')
    }
    window.addEventListener('popstate', followHistory)
    return () => window.removeEventListener('popstate', followHistory)
  }, [])

  useEffect(() => {
    if (!shouldFocus.current) return
    shouldFocus.current = false
    content.current?.querySelector('h1')?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [path])

  function navigate(next: string) {
    if (next === path) return
    history.pushState(null, '', next)
    shouldFocus.current = true
    setPath(next)
    setError('')
  }

  function followLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target
    const link = target instanceof Element ? target.closest('a') : null
    const href = link?.getAttribute('href')
    if (!href?.startsWith('/') || href.startsWith('//') || link?.target || link?.hasAttribute('data-reload')) return
    event.preventDefault()
    navigate(href)
  }

  const update = useCallback<Update>(async (command, options) => {
    try {
      const result = await commit(command)
      setError('')
      return result
    } catch (cause) {
      if (!options?.inlineError) setError(errorMessage(cause))
      throw cause
    }
  }, [commit])

  return (
    <div className="app-shell" onClick={followLink}>
      <a href="#inhoud" className="skip-link">Naar inhoud</a>
      <header className="site-header">
        <div className="site-width header-inner">
          <BrandLink />
          <nav aria-label="Hoofdnavigatie" className="site-nav">
            {links.map(({ href, label, icon: Icon }) => {
              const showUnread = href === '/berichten' && unread > 0
              return (
                <Button key={href} component="a" href={href} size="sm" variant={area === href ? 'light' : 'subtle'}
                  aria-label={showUnread ? `${label}, ${unreadLabel}` : undefined} aria-current={area === href ? 'page' : undefined}
                  leftSection={<span className="nav-icon" aria-hidden="true">
                    <Icon size={18} />
                    {showUnread && <span key={arrival} className="nav-unread">{unread > 99 ? '99+' : unread}</span>}
                  </span>}>
                  {label}
                </Button>
              )
            })}
          </nav>
          <VisuallyHidden role="status">{unread > 0 && <span key={arrival}>{unreadLabel}</span>}</VisuallyHidden>
        </div>
      </header>
      {(!hosted || hosted.logout) && <div className="demo-strip">
        <div className="site-width">
          <Badge variant="light" color="ochre">{hosted ? state?.displayName : sendMessage ? `Proefaccount · ${state?.displayName ?? '…'}` : 'Voorbeeldgegevens'}</Badge>
          {hosted?.logout ? <Button variant="subtle" size="compact-sm" onClick={hosted.logout}>Uitloggen</Button> :
            sendMessage && <Anchor href="/inloggen" size="sm" fw={700}>Proefaccounts</Anchor>}
        </div>
      </div>}
      {hosted?.notice}
      {error && (
        <Alert className="app-error" color="red" title="Dat ging niet goed" withCloseButton closeButtonLabel="Sluit melding" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <main className="site-width" id="inhoud" ref={content}>
        <div className="page-transition" key={area}>
          {area === '/inloggen' ? hosted?.signIn ?? <SignInPage navigate={navigate} /> : state ? (
            area === '/ruilen' ? <OffersPage state={state} update={update} navigate={navigate} signedIn={!!sendMessage} /> :
            area === '/album' ? <AlbumPage state={state} update={update} markAlbum={markAlbum} /> :
            area === '/berichten' ? <MessagesPage state={state} threadId={path.split('/')[2]} demoKey={historyKey} update={update} sendMessage={sendMessage} /> :
            area === '/instellingen' ? <SettingsPage state={state} update={update} demoKey={historyKey}
              eraseAccount={eraseAccount} usesDescope={!!hosted} /> :
            <EmptyState title="Deze pagina bestaat niet" action={<Button component="a" href="/ruilen">Ga naar Ruilen</Button>}>Je vindt alle beschikbare stickers bij Ruilen.</EmptyState>
          ) : area === '/ruilen' && hosted?.landing ? hosted.landing : hosted?.placeholder ? hosted.placeholder : authStopped ? (
            <EmptyState title="Proefaccount kon niet openen" action={<Button onClick={() => window.location.reload()}>Opnieuw proberen</Button>}>
              <Anchor href="/inloggen?proef=demo" data-reload>Terug naar inloggen</Anchor>
              Controleer of de lokale Convex-server draait.
            </EmptyState>
          ) : <Group className="loading" role="status"><Loader size="sm" /><Text>Even het album pakken…</Text></Group>}
        </div>
      </main>
    </div>
  )
}

export function LocalSetup() {
  return (
    <main className="site-width loading">
      <Paper withBorder p="xl">
        <Title order={1}>Stickerruil Zwolle</Title>
        <Text mt="sm">Deze proef heeft een lokale Convex-server nodig. Start die met <code>npm run dev:convex</code> en start daarna de webapp opnieuw.</Text>
      </Paper>
    </main>
  )
}
