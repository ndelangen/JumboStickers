import { useState } from 'react'
import { Alert, Anchor, Button, Group, Modal, Paper, Stack, Switch, Text, TextInput, Title } from '@mantine/core'
import { ArrowRight, Inbox, Mail, Trash2 } from 'lucide-react'
import { clearLocalHistory } from '../chatStorage'
import { errorMessage, type DemoState, type Update } from '../demo'
import { PageHeading, PhotoCredit } from '../ui'

export function SignInPage({ navigate }: { navigate: (path: string) => void }) {
  const [email, setEmail] = useState('')
  const [requested, setRequested] = useState('')
  const accountRemoved = new URLSearchParams(location.search).get('account') === 'verwijderd'
  return (
    <>
      <section className="sign-in">
        <div className="sign-in-photo" aria-hidden="true" />
        <Paper className="sign-in-form" radius={0} p="xl">
          <Stack>
            <div className="mail-sticker" aria-hidden>{requested ? <Inbox size={28} /> : <Mail size={28} />}</div>
            {accountRemoved && <Alert color="olive" role="status">Je account is gesloten. We wissen je gegevens.</Alert>}
            <PageHeading title={requested ? 'Kijk in je inbox' : 'Inloggen om te ruilen'} />
            {requested ? (
              <>
                <Text>Je inloglink gaat naar <strong>{requested}</strong>. Klik op de link en je bent meteen ingelogd.</Text>
                <Alert color="ochre">In deze proef sturen we geen mail. Je kunt hieronder de voorbeeldlink openen.</Alert>
                <Button rightSection={<ArrowRight size={18} aria-hidden />} onClick={() => navigate('/album')}>Open de voorbeeldlink</Button>
                <Button variant="subtle" onClick={() => setRequested('')}>Gebruik een ander e-mailadres</Button>
              </>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); setRequested(email.trim()) }}>
                <Stack>
                  <Text>Je hoeft geen wachtwoord aan te maken. Vul je e-mailadres in en je krijgt een link waarmee je meteen inlogt.</Text>
                  <TextInput required label="E-mailadres" placeholder="naam@voorbeeld.nl" type="email" autoComplete="email"
                    description="Andere verzamelaars zien je e-mailadres nooit."
                    value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
                  <Button type="submit" leftSection={<Mail size={18} aria-hidden />}>Stuur mij een inloglink</Button>
                  <Text c="dimmed" size="sm">Je kunt dit uitproberen met een verzonnen adres.</Text>
                </Stack>
              </form>
            )}
          </Stack>
        </Paper>
      </section>
      <Paper withBorder className="local-accounts" p="md">
        <Stack gap="sm">
          <Title order={2}>Probeer samen te ruilen</Title>
          <Text>Open Noor en Sam elk in een eigen tabblad. In de beginstand biedt Noor sticker 34 aan en Sam sticker 12.</Text>
          <Group gap="xs">
            <Button component="a" href="/ruilen?proef=noor" target="_blank" rel="noopener">Open Noor</Button>
            <Button component="a" href="/ruilen?proef=sam" target="_blank" rel="noopener" variant="light">Open Sam</Button>
            <Anchor href="/ruilen?proef=demo" data-reload>Terug naar de losse demo</Anchor>
          </Group>
        </Stack>
      </Paper>
      <div className="sign-in-credit"><PhotoCredit /></div>
    </>
  )
}

export function SettingsPage({ state, update, demoKey, eraseAccount }: {
  state: DemoState
  update: Update
  demoKey: string
  eraseAccount?: () => Promise<null>
}) {
  const [displayName, setDisplayName] = useState(state.displayName)
  const [digest, setDigest] = useState(state.digest)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState('')
  return (
    <>
      <PageHeading title="Instellingen" />
      <div className="settings-layout">
        <Paper component="form" withBorder p="lg" onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          try {
            await update({ type: 'profile', displayName, digest })
            setFeedback('Je instellingen zijn opgeslagen.')
          } catch { /* App displays the error. */ } finally { setBusy(false) }
        }}>
          <Stack>
            <Title order={2}>Je profiel</Title>
            <TextInput required label="Schermnaam" maxLength={32} value={displayName} onChange={(event) => {
              setDisplayName(event.currentTarget.value)
              setFeedback('')
            }} />
            <Switch label="Mail me over nieuwe ruilkansen" checked={digest}
              description="Eén overzicht om 16.00 uur met stickers die je zoekt en waar nog niemand om heeft gevraagd."
              onChange={(event) => { setDigest(event.currentTarget.checked); setFeedback('') }} />
            <Group><Button loading={busy} type="submit">Opslaan</Button><Text role="status" c="dimmed">{feedback}</Text></Group>
          </Stack>
        </Paper>
        <Paper withBorder p="lg">
          <Stack>
            <Title order={2}>Chat op dit apparaat</Title>
            <Text>Je kunt gelezen en verstuurde berichten wissen uit deze browser.</Text>
            <Button variant="outline" color="red" leftSection={<Trash2 size={17} aria-hidden />}
              onClick={() => { setError(''); setConfirm(true) }}>Wis lokale chatgeschiedenis</Button>
            {error && <Text role="alert" c="red">{error}</Text>}
            <Anchor href="/inloggen">Bekijk het inlogscherm</Anchor>
          </Stack>
        </Paper>
      </div>
      {eraseAccount && (
        <Paper withBorder p="lg" className="account-removal">
          <Stack align="flex-start" gap="sm">
            <Title order={2}>Je account verwijderen</Title>
            <Text>Hiermee stop je met ruilen en verwijder je jouw gegevens.</Text>
            <Button variant="outline" color="red" leftSection={<Trash2 size={17} aria-hidden />} onClick={() => {
              setRemovalError('')
              setConfirmRemoval(true)
            }}>Verwijder mijn account</Button>
          </Stack>
        </Paper>
      )}
      {eraseAccount && (
        <Modal opened={confirmRemoval} onClose={() => { if (!removing) setConfirmRemoval(false) }}
          title="Je account definitief verwijderen?" closeButtonProps={{ 'aria-label': 'Sluit bevestiging' }}
          withCloseButton={!removing} centered>
          <Stack>
            <Text>We wissen je profiel, album, aanbod, interesses, ruilafspraken en berichten op de server. We wissen ook je chatgeschiedenis in deze browser.</Text>
            <Text>Berichten die iemand al in zijn eigen browser heeft opgeslagen, blijven daar staan. Je kunt deze actie niet ongedaan maken.</Text>
            {removalError && <Text role="alert" c="red">{removalError}</Text>}
            <Group>
              <Button autoFocus variant="light" disabled={removing} onClick={() => setConfirmRemoval(false)}>Annuleren</Button>
              <Button color="red" loading={removing} onClick={async () => {
                setRemoving(true)
                try {
                  await eraseAccount()
                } catch (cause) {
                  setRemovalError(errorMessage(cause))
                  setRemoving(false)
                }
              }}>Verwijder mijn account</Button>
            </Group>
          </Stack>
        </Modal>
      )}
      <Modal opened={confirm} onClose={() => setConfirm(false)} title="Chatgeschiedenis wissen?"
        closeButtonProps={{ 'aria-label': 'Sluit bevestiging' }} centered>
        <Stack>
          <Text>De gelezen en verstuurde berichten op dit apparaat worden gewist.</Text>
          <Group>
            <Button variant="light" onClick={() => setConfirm(false)}>Annuleren</Button>
            <Button color="red" onClick={async () => {
              try {
                await clearLocalHistory(demoKey)
                setConfirm(false)
                setFeedback('De lokale chatgeschiedenis is gewist.')
              } catch {
                setError('Het wissen is niet gelukt. Probeer het opnieuw.')
                setConfirm(false)
              }
            }}>Wis geschiedenis</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
