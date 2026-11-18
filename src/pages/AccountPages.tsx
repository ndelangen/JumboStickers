import { useState } from 'react'
import { Alert, Anchor, Button, Group, Modal, Paper, Stack, Switch, Text, TextInput, Title } from '@mantine/core'
import { ArrowRight, Inbox, Mail, Trash2 } from 'lucide-react'
import { clearLocalHistory } from '../chatStorage'
import type { DemoState, Update } from '../demo'
import { PageHeading, PhotoCredit } from '../ui'

export function SignInPage({ navigate }: { navigate: (path: string) => void }) {
  const [email, setEmail] = useState('')
  const [requested, setRequested] = useState('')
  return (
    <>
      <section className="sign-in">
        <div className="sign-in-photo" aria-hidden="true" />
        <Paper className="sign-in-form" radius={0} p="xl">
          <Stack>
            <div className="mail-sticker" aria-hidden>{requested ? <Inbox size={28} /> : <Mail size={28} />}</div>
            <PageHeading title={requested ? 'Kijk in je inbox' : 'Inloggen'} />
            {requested ? (
              <>
                <Text>De inloglink gaat straks naar <strong>{requested}</strong>. Open de link binnen vijf minuten. Deel hem met niemand.</Text>
                <Alert color="ochre">In deze proef wordt geen mail verstuurd. Bij livegang tonen we hier het exacte afzenderadres.</Alert>
                <Button rightSection={<ArrowRight size={18} aria-hidden />} onClick={() => navigate('/album')}>Open de voorbeeldlink</Button>
                <Button variant="subtle" onClick={() => setRequested('')}>Gebruik een ander e-mailadres</Button>
              </>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); setRequested(email.trim()) }}>
                <Stack>
                  <Text>Vul je e-mailadres in. Je krijgt een link waarmee je één keer kunt inloggen.</Text>
                  <TextInput required label="E-mailadres" placeholder="naam@voorbeeld.nl" type="email" autoComplete="email"
                    value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
                  <Button type="submit" leftSection={<Mail size={18} aria-hidden />}>Stuur mij een inloglink</Button>
                  <Text c="dimmed" size="sm">Je kunt dit uitproberen met een verzonnen adres.</Text>
                </Stack>
              </form>
            )}
          </Stack>
        </Paper>
      </section>
      <div className="sign-in-credit"><PhotoCredit /></div>
    </>
  )
}

export function SettingsPage({ state, update, demoKey }: { state: DemoState; update: Update; demoKey: string }) {
  const [displayName, setDisplayName] = useState(state.displayName)
  const [digest, setDigest] = useState(state.digest)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
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
