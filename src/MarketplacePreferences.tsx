import { Stack, Switch, Text } from '@mantine/core'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../convex/_generated/api'
import { errorMessage, type DemoState } from './demo'

type Preferences = NonNullable<DemoState['marketplacePreferences']>

export const defaultMarketplacePreferences: Preferences = { hideUnanswered: true, hideBlocked: true }

export function MarketplacePreferences({ preferences = defaultMarketplacePreferences }: { preferences?: Preferences }) {
  const save = useMutation(api.exchange.setMarketplacePreference)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function change(preference: keyof Preferences, enabled: boolean) {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await save({ preference, enabled })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <Stack gap="sm">
    <Switch label="Verberg aanbod als ik op antwoord wacht"
      description="Na 7 dagen zonder antwoord. Bij een reactie verschijnt het aanbod weer."
      checked={preferences.hideUnanswered} aria-disabled={saving}
      onChange={(event) => void change('hideUnanswered', event.currentTarget.checked)} />
    <Switch label="Verberg aanbod van mensen die ik heb geblokkeerd"
      checked={preferences.hideBlocked} aria-disabled={saving}
      onChange={(event) => void change('hideBlocked', event.currentTarget.checked)} />
    {error && <Text role="alert" c="red">{error}</Text>}
  </Stack>
}
