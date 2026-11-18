import { MultiSelect, NativeSelect } from '@mantine/core'
import { districts, uniqueDistricts, type District } from '../convex/districts'

export function HomeDistrictField({ value, onChange, disabled, label = 'Woonwijk (optioneel)' }: {
  value?: District | null
  onChange: (district: District | null) => void
  disabled?: boolean
  label?: string
}) {
  return <NativeSelect label={label}
    description="Andere ingelogde verzamelaars zien deze wijk bij je aanbod."
    data={[{ value: '', label: 'Geen wijk delen' }, ...districts]}
    value={value ?? ''} disabled={disabled}
    onChange={(event) => onChange(districts.find((district) => district === event.currentTarget.value) ?? null)} />
}

export function SearchDistrictsField({ value, onChange, disabled, inOffers = false }: {
  value: District[]
  onChange: (districts: District[]) => void
  disabled?: boolean
  inOffers?: boolean
}) {
  return <MultiSelect
    label={inOffers ? undefined : 'In welke wijken wil je standaard zoeken?'}
    description={inOffers ? undefined : 'Je keuze blijft privé. Zonder selectie zoek je in alle wijken.'}
    aria-label={inOffers ? 'Filter op wijken' : undefined}
    placeholder={value.length ? undefined : inOffers ? 'Alle wijken' : 'Kies wijken'}
    clearButtonProps={{ 'aria-label': 'Wis geselecteerde wijken', 'aria-hidden': false, tabIndex: 0 }}
    wrapperProps={{ onKeyDown: (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !event.nativeEvent.isComposing) {
        event.preventDefault()
      }
    } }}
    data={[...districts]} searchable clearable selectFirstOptionOnChange nothingFoundMessage="Geen wijken gevonden"
    value={value} onChange={(selection) => onChange(uniqueDistricts(selection))} disabled={disabled} />
}
