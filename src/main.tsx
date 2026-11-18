import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import '@fontsource/athiti/latin-400.css'
import '@fontsource/athiti/latin-600.css'
import '@fontsource/athiti/latin-700.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@mantine/core/styles.css'
import './app.css'
import { DemoApp, ExchangeApp, LocalSetup } from './App'
import { LocalAccountsProvider, localAuthProvider, selectedAccount } from './LocalAccounts'
import { albumTheme, albumVariables } from './theme'
import { UnsubscribePage } from './pages/UnsubscribePage'
import { unsubscribePath } from '../shared/digestLinks'

const HostedApp = lazy(() => import('./HostedApp').then(({ HostedApp }) => ({ default: HostedApp })))
const configured = import.meta.env.VITE_CONVEX_URL
const projectId = import.meta.env.VITE_DESCOPE_PROJECT_ID
const baseUrl = import.meta.env.VITE_DESCOPE_API_URL
const flowId = import.meta.env.VITE_DESCOPE_FLOW_ID
const local = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\/?$/u.test(configured ?? '') ? configured : null
const client = local ? new ConvexReactClient(local) : null
const account = local ? selectedAccount(local) : null
const hosted = /^https:\/\/[a-z0-9.-]+\.convex\.cloud\/?$/u.test(configured ?? '') && projectId && baseUrl && flowId
  ? { client: new ConvexReactClient(configured), config: { projectId, baseUrl, flowId } } : null
const unsubscribeClient = hosted?.client ?? client

const app = unsubscribeClient && location.pathname.replace(/\/$/u, '') === unsubscribePath
  ? <ConvexProvider client={unsubscribeClient}><UnsubscribePage /></ConvexProvider>
  : client && local
  ? account ? (
    <LocalAccountsProvider client={client} fetchAccessToken={localAuthProvider(local, account)}>
      <ExchangeApp selection={account} />
    </LocalAccountsProvider>
  ) : <ConvexProvider client={client}><DemoApp /></ConvexProvider>
  : hosted
    ? <Suspense fallback={<p role="status">Even laden…</p>}>
      <HostedApp {...hosted} />
    </Suspense>
    : <LocalSetup />

createRoot(document.getElementById('root')!).render(
  <MantineProvider forceColorScheme="light" theme={albumTheme} cssVariablesResolver={albumVariables}>
    {app}
  </MantineProvider>,
)
