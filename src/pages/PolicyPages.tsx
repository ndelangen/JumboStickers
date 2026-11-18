import { Anchor, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { PageHeading } from '../ui'

const controller = import.meta.env.VITE_PRIVACY_CONTROLLER_NAME?.trim()
const contact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL?.trim()
const privacyContact = contact ? `mailto:${contact}` : undefined

function Policy({ title, introduction, children }: { title: string, introduction: string, children: ReactNode }) {
  return (
    <article className="policy">
      <PageHeading title={title} description={introduction} />
      {children}
    </article>
  )
}

function PolicySection({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="policy-section">
      <Title order={2}>{title}</Title>
      {children}
    </section>
  )
}

export function PrivacyPage() {
  return (
    <Policy title="Privacyverklaring" introduction="Welke gegevens Stickerruil Zwolle gebruikt en wat je zelf kunt wissen.">
      <PolicySection title="Wie beheert Stickerruil Zwolle?">
        <Text>{controller ? `${controller} beheert Stickerruil Zwolle.` : 'De naam van de beheerder wordt vóór publicatie ingevuld.'}</Text>
        {privacyContact && <Text>Voor privacyvragen of een verzoek over je gegevens kun je mailen naar <Anchor href={privacyContact}>{contact}</Anchor>.</Text>}
      </PolicySection>
      <PolicySection title="Inloggen, je album en ruilen">
        <Text>Als je een inloglink aanvraagt, gebruikt Descope je e-mailadres om de link te versturen en je inlogaccount te beheren. Andere verzamelaars zien je e-mailadres nooit. Je hebt een e-mailadres nodig om een account te maken en mee te ruilen.</Text>
        <Text>Stickerruil bewaart je schermnaam, een inlogkenmerk, je album, je zoeklijst, je aanbod, je interesses, je ruilafspraken en wie je in de chat hebt geblokkeerd. Andere ingelogde verzamelaars zien je schermnaam bij je aanbod en in gesprekken met jou. Als je interesse toont in een sticker, ziet de aanbieder je schermnaam. Bij een mogelijke ruil kunnen we laten zien dat je een bepaalde sticker zoekt.</Text>
        <Text>Als je een woonwijk kiest, zien andere ingelogde verzamelaars die bij je aanbod en kunnen ze erop filteren. We bewaren ook de wijken waarin je standaard wilt zoeken. Die keuze is alleen voor jou zichtbaar. Je kunt beide keuzes aanpassen of wissen bij Instellingen.</Text>
        <Text>We gebruiken deze gegevens om de ruildienst uit te voeren die je vraagt. Onze diensten kunnen technische gegevens verwerken, zoals je IP-adres, om de site te leveren en te beveiligen. Voor beveiliging en misbruikpreventie steunen we op ons belang om de site veilig te houden.</Text>
      </PolicySection>
      <PolicySection title="Privéberichten">
        <Text>We bewaren berichttekst tijdelijk in onze database. Zodra de ontvanger het bericht in de geopende chat ziet en diens browser het heeft opgeslagen, verwijderen we de tekst automatisch uit de actieve database. Een ongelezen bericht vervalt na 30 dagen. We wissen het eerder als de ontvanger de afzender blokkeert of als een van jullie het Stickerruil-account verwijdert.</Text>
        <Text>Als je iemand blokkeert, kunnen jullie elkaar geen nieuwe berichten sturen. We bewaren de blokkade totdat je die opheft of een van jullie het Stickerruil-account verwijdert.</Text>
        <Text>Om te voorkomen dat hetzelfde bericht twee keer wordt verzonden, bewaren we ongeveer één dag een verzendkenmerk zonder berichttekst. Gelezen en verzonden berichten blijven in de gebruikte browsers staan totdat de geschiedenis daar wordt gewist.</Text>
      </PolicySection>
      <PolicySection title="Cookies en browseropslag">
        <Text>De site gebruikt browseropslag voor je inlogsessie en je chatgeschiedenis. Vanuit <Anchor href="/instellingen">Instellingen</Anchor> kun je de chatgeschiedenis in deze browser wissen. Je kunt ook de sitegegevens via je browser wissen. Daarmee kun je uitloggen en raak je deze lokale geschiedenis kwijt.</Text>
      </PolicySection>
      <PolicySection title="Welke diensten gebruiken we?">
        <ul>
          <li><Anchor href="https://www.netlify.com/gdpr-ccpa/#data-processing-agreement-dpa">Netlify</Anchor> levert de website en verwerkt technische gegevens om die te tonen en te beveiligen.</li>
          <li><Anchor href="https://www.convex.dev/legal/dpa">Convex</Anchor> bewaart je Stickerruil-gegevens. De databasedienst draait in de EU.</li>
          <li><Anchor href="https://www.descope.com/customer-data-processing-amendment">Descope</Anchor> verzorgt je inlogaccount en inlogmail. We gebruiken de EU-regio.</li>
        </ul>
        <Text>Dienstverleners kunnen bij de levering of ondersteuning gegevens buiten de EER verwerken. Hun verwerkersvoorwaarden beschrijven waarborgen voor doorgifte, waaronder contractuele standaardbepalingen waar die nodig zijn. Je kunt ons om informatie daarover vragen.</Text>
      </PolicySection>
      <PolicySection title="Je account wissen en je rechten gebruiken">
        <Text>Je profiel en ruilgegevens blijven bewaard zolang je Stickerruil-account bestaat. Via <Anchor href="/instellingen">Instellingen</Anchor> kun je je schermnaam aanpassen of je Stickerruil-account en de chatgeschiedenis in deze browser wissen. Descope bewaart je inlogidentiteit daarna voor een eventuele nieuwe aanmelding. {privacyContact && 'Via het contactadres hierboven kun je ook vragen om je inlogidentiteit te laten verwijderen.'}</Text>
        <Text>Je kunt vragen om inzage, aanpassing of wissing van je gegevens. Je kunt ook vragen om minder verwerking, bezwaar maken of een kopie vragen om je gegevens over te dragen, voor zover dat recht van toepassing is. Je kunt een klacht indienen bij de <Anchor href="https://autoriteitpersoonsgegevens.nl/een-tip-of-klacht-indienen-bij-de-ap">Autoriteit Persoonsgegevens</Anchor>.</Text>
      </PolicySection>
    </Policy>
  )
}

export function UsageRulesPage() {
  return (
    <Policy title="Gebruiksregels" introduction="Stickerruil Zwolle is een onafhankelijke hobbytool voor verzamelaars van Zwolle: De Stad Ontrafeld.">
      <PolicySection title="Ruil stickers en houd je aanbod bij">
        <Text>Bied alleen stickers aan die je dubbel hebt. Beloof een exemplaar aan één persoon tegelijk. Markeer het als weggegeven als de ruil rond is, of geef het weer vrij als de afspraak niet doorgaat.</Text>
        <Text>Je spreekt samen af welke stickers je ruilt, waar en wanneer. Stickerruil regelt geen betalingen, verzending of overdracht.</Text>
      </PolicySection>
      <PolicySection title="Houd de chat prettig">
        <Text>Gebruik de chat voor je ruil. Stuur geen spam, scheldwoorden, bedreigingen of discriminerende berichten. Deel gegevens of berichten van anderen alleen met hun toestemming.</Text>
        <Text>Deel alleen contactgegevens die je voor de afspraak wilt delen. Je kunt ook op een openbare plek afspreken.</Text>
      </PolicySection>
      <PolicySection title="Probleem melden">
        <Text>Voor misbruik of vragen over de site kun je contact opnemen met de beheerder.{' '}
          {privacyContact ? <Anchor href={privacyContact}>Mail de beheerder</Anchor> : <Anchor href="/privacy">Ga naar de privacyverklaring</Anchor>}.</Text>
      </PolicySection>
    </Policy>
  )
}
