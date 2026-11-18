import { Alert, Anchor, Badge, Button, Group, Loader, Paper, Text, Title } from '@mantine/core'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeftRight, BookOpen, MessageCircle, Settings, Sticker as StickerIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { api } from '../convex/_generated/api'
import { errorMessage, localDemoKey, type Update } from './demo'
import { OffersPage } from './pages/OffersPage'
import { AlbumPage } from './pages/AlbumPage'
import { MessagesPage } from './pages/MessagesPage'
import { SettingsPage, SignInPage } from './pages/AccountPages'
import { EmptyState } from './ui'

const links = [
  { href: '/ruilen', label: 'Ruilen', icon: ArrowLeftRight },
  { href: '/album', label: 'Mijn album', icon: BookOpen },
  { href: '/berichten', label: 'Berichten', icon: MessageCircle },
  { href: '/instellingen', label: 'Instellingen', icon: Settings },
]

function activeArea(path: string) {
  return path === '/' ? '/ruilen' : '/' + path.split('/')[1]
}

export function App() {
  const [demoKey] = useState(localDemoKey)
  const state = useQuery(api.demo.get, { key: demoKey })
  const start = useMutation(api.demo.start)
  const mutate = useMutation(api.demo.update)
  const [path, setPath] = useState(location.pathname)
  const [error, setError] = useState('')
  const content = useRef<HTMLElement>(null)
  const shouldFocus = useRef(false)
  const area = activeArea(path)

  useEffect(() => {
    if (state !== null) return
    void start({ key: demoKey }).catch((cause) => setError(errorMessage(cause)))
  }, [demoKey, start, state])

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
    if (!href?.startsWith('/') || href.startsWith('//') || link?.target) return
    event.preventDefault()
    navigate(href)
  }

  const update = useCallback<Update>(async (command, options) => {
    try {
      const result = await mutate({ key: demoKey, command })
      setError('')
      return result
    } catch (cause) {
      if (!options?.inlineError) setError(errorMessage(cause))
      throw cause
    }
  }, [demoKey, mutate])

  return (
    <div className="app-shell" onClick={followLink}>
      <a href="#inhoud" className="skip-link">Naar inhoud</a>
      <header className="site-header">
        <div className="site-width header-inner">
          <Anchor href="/ruilen" className="brand" underline="never">
            <span className="brand-sticker"><StickerIcon size={25} strokeWidth={1.8} aria-hidden /></span>
            <span className="brand-title">Stickerruil Zwolle</span>
          </Anchor>
          <nav aria-label="Hoofdnavigatie" className="site-nav">
            {links.map(({ href, label, icon: Icon }) => (
              <Button key={href} component="a" href={href} size="sm" variant={area === href ? 'light' : 'subtle'}
                leftSection={<Icon size={18} aria-hidden />} aria-current={area === href ? 'page' : undefined}>
                {label}
              </Button>
            ))}
          </nav>
        </div>
      </header>
      <div className="demo-strip">
        <div className="site-width">
          <Badge variant="light" color="ochre">Voorbeeldgegevens</Badge>
          <Anchor href="/inloggen" size="sm" fw={700}>Inloggen</Anchor>
        </div>
      </div>
      {error && (
        <Alert className="app-error" color="red" title="Dat ging niet goed" withCloseButton closeButtonLabel="Sluit melding" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <main className="site-width" id="inhoud" ref={content}>
        <div className="page-transition" key={area}>
          {area === '/inloggen' ? <SignInPage navigate={navigate} /> : state ? (
            area === '/ruilen' ? <OffersPage state={state} update={update} navigate={navigate} /> :
            area === '/album' ? <AlbumPage state={state} update={update} /> :
            area === '/berichten' ? <MessagesPage state={state} threadId={path.split('/')[2]} demoKey={demoKey} update={update} /> :
            area === '/instellingen' ? <SettingsPage state={state} update={update} demoKey={demoKey} /> :
            <EmptyState title="Deze pagina bestaat niet" action={<Button component="a" href="/ruilen">Ga naar Ruilen</Button>}>Je vindt alle beschikbare stickers bij Ruilen.</EmptyState>
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
