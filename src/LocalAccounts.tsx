import { ConvexHttpClient } from 'convex/browser'
import { ConvexProviderWithAuth, type ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../convex/_generated/api'

export const localAccounts = ['noor', 'sam', 'eva'] as const
export type LocalAccount = typeof localAccounts[number]
type LocalSession = Omit<NonNullable<FunctionReturnType<typeof api.localIdentity.signIn>>, 'token'> & { backend: string }
type LocalSelection = { account: LocalAccount, session?: LocalSession, create: boolean, revoked: boolean }
const accountKey = 'stickerruil.proefaccount'
const sessionKey = 'stickerruil.proefsessie'

function storedSession(backend: string) {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') as LocalSession | null
    if (session?.backend === backend) return session
  } catch {
    sessionStorage.removeItem(sessionKey)
  }
}

function clearAccountParam() {
  const url = new URL(location.href)
  url.searchParams.delete('proef')
  history.replaceState(null, '', url)
}

export function selectedAccount(backend: string): LocalSelection | null {
  const param = new URLSearchParams(location.search).get('proef')
  const name = param ?? sessionStorage.getItem(accountKey)
  const account = localAccounts.find((value) => value === name) ?? null
  const session = param ? undefined : storedSession(backend)
  if (!account) {
    if (param) clearAccountParam()
    clearLocalSession()
    return null
  }
  if (param) sessionStorage.removeItem(sessionKey)
  sessionStorage.setItem(accountKey, account)
  return { account, session, create: !!param, revoked: false }
}

export function localAuthProvider(url: string, selection: LocalSelection) {
  const signer = new ConvexHttpClient(url)
  return async () => {
    try {
      const result = await signer.mutation(api.localIdentity.signIn, {
        persona: selection.account, create: selection.create, expected: selection.session?.id,
      })
      if (!result) {
        selection.revoked = true
        return null
      }
      const { token, ...session } = result
      selection.session = { ...session, backend: url }
      selection.create = false
      selection.revoked = false
      sessionStorage.setItem(sessionKey, JSON.stringify(selection.session))
      clearAccountParam()
      return token
    } catch {
      return null
    }
  }
}

export function clearLocalSession() {
  sessionStorage.removeItem(accountKey)
  sessionStorage.removeItem(sessionKey)
}

export type { LocalSelection }

export function LocalAccountsProvider({ client, fetchAccessToken, children }: {
  client: ConvexReactClient
  fetchAccessToken: ReturnType<typeof localAuthProvider>
  children: ReactNode
}) {
  return (
    <ConvexProviderWithAuth client={client} useAuth={() => ({ isLoading: false, isAuthenticated: true, fetchAccessToken })}>
      {children}
    </ConvexProviderWithAuth>
  )
}
