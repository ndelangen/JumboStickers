import { Alert, Button, Paper, Stack, Text } from '@mantine/core'
import { useMutation } from 'convex/react'
import { Check, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { isUnsubscribeToken, unsubscribePath } from '../../shared/digestLinks'
import { BrandLink, PageHeading } from '../ui'

export function UnsubscribePage() {
  const [token, setToken] = useState(() => location.hash.slice(1))

  useEffect(() => {
    function followLink() { setToken(location.hash.slice(1)) }
    window.addEventListener('hashchange', followLink)
    return () => window.removeEventListener('hashchange', followLink)
  }, [])

  return <UnsubscribeForm key={token} token={token} />
}

function UnsubscribeForm({ token }: { token: string }) {
  const unsubscribe = useMutation(api.digest.unsubscribe)
  const [result, setResult] = useState<'removed' | 'expired'>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const valid = isUnsubscribeToken(token)

  useEffect(() => {
    if (result) panel.current?.querySelector('h1')?.focus()
  }, [result])

  async function confirmUnsubscribe() {
    setBusy(true)
    setError(false)
    try {
      const removed = await unsubscribe({ token })
      if (location.hash !== `#${token}`) return
      history.replaceState(null, '', unsubscribePath)
      setResult(removed ? 'removed' : 'expired')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return <div className="app-shell">
    <header className="site-header"><div className="site-width header-inner"><BrandLink /></div></header>
    <main className="site-width">
      <Paper ref={panel} className="page-transition" withBorder p="xl" maw={480} mx="auto" mt="xl">
        <Stack gap="md" align="flex-start">
          <div className="mail-sticker" aria-hidden>{result === 'removed' ? <Check size={27} /> : <Mail size={27} />}</div>
          <PageHeading title={result === 'removed' ? 'Je bent afgemeld'
            : result === 'expired' ? 'Deze afmeldlink is verlopen' : 'Afmelden voor ruilmails'} />
          {result === 'removed' ? <Text>Je krijgt geen mails meer over nieuwe ruilkansen.</Text>
            : result === 'expired' ? <Text>Je kunt je voorkeur aanpassen in Instellingen.</Text>
            : valid ? <Text>Wil je geen mails meer over nieuwe ruilkansen?</Text>
            : <Text>Deze afmeldlink is ongeldig. Je kunt je voorkeur aanpassen in Instellingen.</Text>}
          {error && <Alert color="red" role="alert">Afmelden is niet gelukt. Probeer het opnieuw.</Alert>}
          {valid && !result ? <Button loading={busy} onClick={() => void confirmUnsubscribe()}>Meld me af</Button>
            : <Button component="a" href={result === 'removed' ? '/ruilen' : '/instellingen'} variant="light">
              {result === 'removed' ? 'Naar Ruilen' : 'Naar Instellingen'}
            </Button>}
        </Stack>
      </Paper>
    </main>
  </div>
}
