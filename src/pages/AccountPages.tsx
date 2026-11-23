import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect, useRef, useState } from 'react'
import { Alert, Anchor, Button, Group, Modal, Paper, Stack, Switch, Text, TextInput, Title } from '@mantine/core'
import { ArrowRight, Inbox, Mail, Trash2 } from 'lucide-react'
import type { FunctionArgs } from 'convex/server'
import type { District } from '../../convex/districts'
import { HomeDistrictField, SearchDistrictsField } from '../DistrictFields'
import { DistrictMap } from '../DistrictMap'
import { MarketplacePreferences } from '../MarketplacePreferences'
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

function DigestSettings({ signOut }: { signOut: () => void }) {
  const preferences = useQuery(api.digest.preferences)
  const subscribe = useMutation(api.digest.subscribe)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visible = !!(preferences?.available || preferences?.subscribed || preferences?.unreadSubscribed)
  useEffect(() => {
    if (visible && location.hash === '#mail-voor-berichten') {
      const reminder = document.getElementById('mail-voor-berichten')
      reminder?.scrollIntoView({ block: 'center' })
      reminder?.focus({ preventScroll: true })
    }
  }, [visible])
  if (!visible || !preferences) return null

  const canEnable = preferences.available && preferences.verifiedEmail
  async function setPreference(kind: 'trades' | 'unread', enabled: boolean) {
    setBusy(true)
    setError('')
    try { await subscribe({ enabled, kind }) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <Paper withBorder p="lg" className="account-removal" id="mail-voor-berichten" tabIndex={-1}>
    <Stack gap="sm">
      <Title order={2}>Dagelijkse mail</Title>
      <Switch label="Mail me over nieuwe ruilkansen" checked={preferences.subscribed}
        disabled={busy || (!canEnable && !preferences.subscribed)}
        description="Om 16.00 uur, als er stickers vrij zijn die je zoekt en waar nog niemand om heeft gevraagd."
        onChange={(event) => void setPreference('trades', event.currentTarget.checked)} />
      <Switch label="Mail me over ongelezen berichten" checked={preferences.unreadSubscribed}
        disabled={busy || (!canEnable && !preferences.unreadSubscribed)}
        description="Om 16.00 uur, met het aantal ongelezen berichten en een link naar Berichten."
        onChange={(event) => void setPreference('unread', event.currentTarget.checked)} />
      <Text size="sm" c="dimmed">Staan beide opties aan? Dan bundelen we de ruilkansen en berichten in één mail.</Text>
      {preferences.available && !preferences.verifiedEmail && (
        <Text size="sm">
          <Anchor component="button" type="button" size="inherit" underline="always" onClick={signOut}>Log opnieuw in</Anchor>
          {' '}om dagelijkse mails aan te zetten. Vraag daarna een nieuwe inloglink aan met hetzelfde e-mailadres.
        </Text>
      )}
      {error && <Text role="alert" c="red">{error}</Text>}
    </Stack>
  </Paper>
}

export function UnreadReminderBanner() {
  const preferences = useQuery(api.digest.preferences)
  const claim = useMutation(api.digest.claimUnreadReminder)
  const requested = useRef(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!preferences?.available || preferences.unreadReminderSeen || preferences.unreadSubscribed) return
    function claimWhenVisible() {
      if (requested.current || document.visibilityState !== 'visible') return
      requested.current = true
      void claim({}).then(setVisible, () => {})
    }
    claimWhenVisible()
    document.addEventListener('visibilitychange', claimWhenVisible)
    return () => document.removeEventListener('visibilitychange', claimWhenVisible)
  }, [claim, preferences])
  if (!visible || preferences?.unreadSubscribed) return null

  return <Alert className="site-width" mt="md" color="olive" icon={<Mail size={20} aria-hidden />}
    title="Nieuw op Stickerruil" withCloseButton closeButtonLabel="Sluit deze melding"
    onClose={() => setVisible(false)}>
    <Stack gap="xs" align="flex-start">
      <Text size="sm">Wil je om 16.00 uur een seintje als er nog berichten op je wachten? Zet de herinnering aan in Instellingen.</Text>
      <Button component="a" href="/instellingen#mail-voor-berichten" data-reload size="compact-sm" variant="light"
        onClick={() => setVisible(false)}>Naar mailinstellingen</Button>
    </Stack>
  </Alert>
}

export function SignupProfile({ register }: {
  register: (args: FunctionArgs<typeof api.account.registerOwn>) => Promise<null>
}) {
  const [name, setName] = useState('')
  const [district, setDistrict] = useState<District | null>(null)
  const [searchDistricts, setSearchDistricts] = useState<District[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <Paper component="form" withBorder p="xl" className="local-accounts" onSubmit={async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try { await register({ displayName: name, district: district ?? undefined, searchDistricts }) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }}>
    <Stack>
      <PageHeading title="Maak je profiel aan" />
      <TextInput label="Schermnaam" maxLength={32} required value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <HomeDistrictField label="In welke wijk woon je?" value={district} onChange={setDistrict} disabled={saving} />
      <SearchDistrictsField value={searchDistricts} onChange={setSearchDistricts} disabled={saving} />
      {error && <Text role="alert" c="red">{error}</Text>}
      <Button type="submit" loading={saving} disabled={!name.trim()}>Verder naar Stickerruil</Button>
    </Stack>
  </Paper>
}

export function SettingsPage({ state, update, demoKey, eraseAccount, usesDescope, signOut, signedIn }: {
  state: DemoState
  update: Update
  demoKey: string
  eraseAccount?: () => Promise<null>
  usesDescope: boolean
  signOut?: () => void
  signedIn: boolean
}) {
  const [displayName, setDisplayName] = useState(state.displayName)
  const [districtDraft, setDistrictDraft] = useState<District | null>()
  const district = districtDraft === undefined ? state.district : districtDraft
  const [searchDraft, setSearchDraft] = useState<District[]>()
  const [digest, setDigest] = useState(state.digest)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removalError, setRemovalError] = useState('')
  const searchDistricts = searchDraft ?? state.searchDistricts ?? []

  function changeDistrict(value: District | null) {
    setDistrictDraft(value)
    setFeedback('')
  }

  function changeSearchDistricts(value: District[]) {
    setSearchDraft(value)
    setFeedback('')
  }

  return (
    <>
      <PageHeading title="Instellingen" />
      <div className="settings-layout">
        <Paper component="form" withBorder p="lg" className="settings-profile" onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          try {
            await update({
              type: 'profile', displayName, digest,
              ...(districtDraft === undefined ? {} : { district: districtDraft }),
              ...(searchDraft === undefined ? {} : { searchDistricts: searchDraft }),
            })
            setDistrictDraft(undefined)
            setSearchDraft(undefined)
            setFeedback('Je instellingen zijn opgeslagen.')
          } catch { /* App displays the error. */ } finally { setBusy(false) }
        }}>
          <div className="settings-profile-grid">
            <Stack className="settings-profile-fields">
              <Title order={2}>Je profiel</Title>
              <TextInput required label="Schermnaam" maxLength={32} value={displayName} onChange={(event) => {
                setDisplayName(event.currentTarget.value)
                setFeedback('')
              }} />
              <HomeDistrictField value={district} disabled={busy} onChange={changeDistrict} />
              <SearchDistrictsField value={searchDistricts} disabled={busy} onChange={changeSearchDistricts} />
              {!usesDescope && <Switch label="Mail me over nieuwe ruilkansen" checked={digest}
                description="Eén overzicht om 16.00 uur met stickers die je zoekt en waar nog niemand om heeft gevraagd."
                onChange={(event) => { setDigest(event.currentTarget.checked); setFeedback('') }} />}
            </Stack>
            <DistrictMap district={district} searchDistricts={searchDistricts} disabled={busy}
              onDistrictChange={changeDistrict} onSearchChange={changeSearchDistricts} />
            <Group className="settings-profile-actions">
              <Button loading={busy} type="submit">Opslaan</Button><Text role="status" c="dimmed">{feedback}</Text>
            </Group>
          </div>
        </Paper>
        {signedIn && <Paper withBorder p="lg">
          <Stack>
            <Title order={2}>Filters voor ruilaanbod</Title>
            <MarketplacePreferences preferences={state.marketplacePreferences} />
          </Stack>
        </Paper>}
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
      {signOut && <DigestSettings signOut={signOut} />}
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
            <Text>We wissen je profiel, album, aanbod, interesses, ruilafspraken en berichten bij Stickerruil. We wissen ook je chatgeschiedenis in deze browser en loggen je uit.</Text>
            {usesDescope && <Text>Descope bewaart je e-mailadres voor als je later opnieuw wilt inloggen.</Text>}
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
