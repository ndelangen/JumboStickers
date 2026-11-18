import { ConvexHttpClient } from 'convex/browser'
import { ConvexProviderWithAuth, type ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import { api } from '../convex/_generated/api'

export const localAccounts = ['noor', 'sam', 'eva'] as const
export type LocalAccount = typeof localAccounts[number]

export function selectedAccount(): LocalAccount | null {
  const param = new URLSearchParams(location.search).get('proef')
  const name = param ?? sessionStorage.getItem('stickerruil.proefaccount')
  const account = localAccounts.find((value) => value === name) ?? null
  if (account) sessionStorage.setItem('stickerruil.proefaccount', account)
  else sessionStorage.removeItem('stickerruil.proefaccount')
  if (param) {
    const url = new URL(location.href)
    url.searchParams.delete('proef')
    history.replaceState(null, '', url)
  }
  return account
}

export function localAuthProvider(url: string, account: LocalAccount) {
  const signer = new ConvexHttpClient(url)
  return async () => {
    try {
      return await signer.mutation(api.localIdentity.signIn, { persona: account })
    } catch {
      return null
    }
  }
}

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
